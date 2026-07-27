import createClient, { type ClientOptions, type Middleware } from "openapi-fetch";
import type { paths } from "../_generated/schema.js";
import type { AuthProvider } from "../auth/types.js";
import {
	TochkaError,
	type TochkaErrorPayload,
	TochkaNetworkError,
	TochkaUnknownOutcomeError,
} from "../errors/index.js";
import {
	computeBackoffMs,
	isAbortError,
	isReadOnlyMethod,
	isRetryableMethod,
	parseRetryAfter,
	type RetryOptions,
	sleep,
	validateRetryOptions,
} from "./retry.js";

export type TochkaFetchClient = ReturnType<typeof createClient<paths>>;

export interface TochkaFetchInit {
	baseUrl: string;
	auth: AuthProvider;
	customerCode?: string | undefined;
	/** Переопределение HTTP-клиента (например, для тестов). */
	fetch?: typeof fetch | undefined;
	/** Доп. заголовки для каждого запроса. */
	headers?: Record<string, string> | undefined;
	/** User-Agent. */
	userAgent?: string | undefined;
	/** Таймаут запроса в мс (клиентский). */
	timeoutMs?: number | undefined;
	/** Хук телеметрии. */
	onRequest?: ((info: { method: string; url: string }) => void) | undefined;
	onResponse?:
		| ((info: { method: string; url: string; status: number; durationMs: number }) => void)
		| undefined;
}

interface TimeoutState {
	timer: ReturnType<typeof setTimeout>;
	timedOut: boolean;
	existing: AbortSignal;
	forwardAbort: () => void;
}

const timeoutStates = new WeakMap<Request, TimeoutState>();
const startTimes = new WeakMap<Request, number>();

export function buildFetchClient(init: TochkaFetchInit): TochkaFetchClient {
	const baseHeaders: Record<string, string> = {
		Accept: "application/json",
		"User-Agent": init.userAgent ?? "onreza-tochka-sdk",
		...(init.headers ?? {}),
	};
	if (init.customerCode) baseHeaders.CustomerCode = init.customerCode;

	const options: ClientOptions = {
		baseUrl: init.baseUrl,
		headers: baseHeaders,
	};
	if (init.fetch) (options as { fetch?: typeof fetch }).fetch = init.fetch;

	const client = createClient<paths>(options);
	client.use(authMiddleware(init.auth));
	client.use(errorMiddleware());
	const telemetry = telemetryMiddleware(init);
	if (telemetry) client.use(telemetry);
	const timeout = timeoutMiddleware(init.timeoutMs);
	if (timeout) client.use(timeout);
	return client;
}

function authMiddleware(auth: AuthProvider): Middleware {
	return {
		async onRequest({ request }) {
			const headers = await auth.getHeaders();
			for (const [k, v] of Object.entries(headers)) request.headers.set(k, v);
			return request;
		},
	};
}

function timeoutMiddleware(timeoutMs: number | undefined): Middleware | null {
	if (!timeoutMs || timeoutMs <= 0) return null;
	return {
		async onRequest({ request }) {
			const ac = new AbortController();
			const existing = request.signal;
			const forwardAbort = () => ac.abort(existing.reason);
			let state: TimeoutState;
			const timer = setTimeout(() => {
				state.timedOut = true;
				ac.abort(new Error(`Request timed out after ${timeoutMs}ms`));
			}, timeoutMs);
			state = { timer, timedOut: false, existing, forwardAbort };
			existing.addEventListener("abort", forwardAbort, { once: true });
			const newReq = new Request(request, { signal: ac.signal });
			timeoutStates.set(newReq, state);
			return newReq;
		},
		async onResponse({ request, response }) {
			clearRequestTimeout(request);
			return response;
		},
		async onError({ request, error }) {
			const state = timeoutStates.get(request);
			clearRequestTimeout(request);
			if (!state?.timedOut) return;
			const message = `Request timed out after ${timeoutMs}ms`;
			const details = { url: request.url, method: request.method, cause: error };
			return isReadOnlyMethod(request.method)
				? new TochkaNetworkError(message, details)
				: new TochkaUnknownOutcomeError(
						`${message}. The operation outcome is unknown; do not retry without idempotency.`,
						details,
					);
		},
	};
}

function clearRequestTimeout(request: Request): void {
	const state = timeoutStates.get(request);
	if (!state) return;
	clearTimeout(state.timer);
	state.existing.removeEventListener("abort", state.forwardAbort);
	timeoutStates.delete(request);
}

function errorMiddleware(): Middleware {
	return {
		async onResponse({ request, response }) {
			if (response.ok) return response;
			// Response.body — one-shot stream, поэтому читаем из клона.
			const cloned = response.clone();
			let payload: TochkaErrorPayload | undefined;
			let rawBody: string | undefined;
			try {
				rawBody = await cloned.text();
				const trimmed = rawBody.trim();
				if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
					payload = JSON.parse(rawBody) as TochkaErrorPayload;
				}
			} catch {}
			const requestId =
				response.headers.get("x-request-id") ??
				response.headers.get("x-correlation-id") ??
				undefined;
			throw TochkaError.from({
				status: response.status,
				url: request.url,
				method: request.method,
				requestId,
				payload,
				rawBody,
			});
		},
	};
}

function telemetryMiddleware(init: TochkaFetchInit): Middleware | null {
	const onReq = init.onRequest;
	const onRes = init.onResponse;
	if (!onReq && !onRes) return null;
	return {
		async onRequest({ request }) {
			startTimes.set(request, performance.now());
			onReq?.({ method: request.method, url: request.url });
			return request;
		},
		async onResponse({ request, response }) {
			const start = startTimes.get(request) ?? performance.now();
			startTimes.delete(request);
			onRes?.({
				method: request.method,
				url: request.url,
				status: response.status,
				durationMs: performance.now() - start,
			});
			return response;
		},
	};
}

/**
 * Обёртка для ретраев: openapi-fetch middleware не поддерживает повторное выполнение,
 * поэтому retry делаем вокруг низкоуровневого fetch.
 *
 * `AbortError` от пользовательского signal никогда не ретраится.
 */
export function makeRetryingFetch(
	opts: RetryOptions,
	baseFetch: typeof fetch = fetch,
): typeof fetch {
	validateRetryOptions(opts);
	const retrying = async function retryingFetch(
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> {
		const requestTemplate = typeof Request !== "undefined" ? new Request(input, init) : null;
		const method = (requestTemplate?.method ?? init?.method ?? "GET").toUpperCase();
		const signal: AbortSignal | undefined = requestTemplate?.signal ?? init?.signal ?? undefined;
		if (signal?.aborted) {
			throw signal.reason ?? new DOMException("Aborted", "AbortError");
		}
		const mayRetry = isRetryableMethod(method, opts);
		const maxAttempts = mayRetry ? opts.maxAttempts : 1;
		const url =
			requestTemplate?.url ??
			(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
		let attempt = 0;
		while (attempt < maxAttempts) {
			attempt += 1;
			let response: Response;
			try {
				const attemptInput = requestTemplate?.clone() ?? input;
				response = await baseFetch(attemptInput, requestTemplate ? undefined : init);
			} catch (err) {
				const aborted = isAbortError(err) || signal?.aborted;
				if (aborted || !opts.retryOnNetworkError || attempt >= maxAttempts) {
					const message = `Network error after ${attempt} attempt(s): ${(err as Error).message}`;
					const details = { url, method, cause: err };
					if (aborted && isReadOnlyMethod(method)) throw signal?.reason ?? err;
					throw isReadOnlyMethod(method)
						? new TochkaNetworkError(message, details)
						: new TochkaUnknownOutcomeError(
								`${message}. The operation outcome is unknown; do not retry without idempotency.`,
								details,
							);
				}
				await sleep(computeBackoffMs(attempt, opts), signal);
				continue;
			}
			if (!opts.retryableStatuses.has(response.status) || attempt >= maxAttempts) return response;
			const retryAfter = parseRetryAfter(response.headers.get("retry-after"), opts.maxDelayMs);
			await response.body?.cancel().catch(() => undefined);
			await sleep(retryAfter ?? computeBackoffMs(attempt, opts), signal);
		}
		throw new Error("makeRetryingFetch: unreachable — validateRetryOptions should prevent this");
	};
	return retrying as unknown as typeof fetch;
}
