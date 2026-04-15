import createClient, { type ClientOptions, type Middleware } from "openapi-fetch";
import type { paths } from "../_generated/schema.js";
import type { AuthProvider } from "../auth/types.js";
import { TochkaError, type TochkaErrorPayload, TochkaNetworkError } from "../errors/index.js";
import {
	type RetryOptions,
	computeBackoffMs,
	isAbortError,
	parseRetryAfter,
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

const timers = new WeakMap<Request, ReturnType<typeof setTimeout>>();
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
	const timeout = timeoutMiddleware(init.timeoutMs);
	if (timeout) client.use(timeout);
	client.use(errorMiddleware());
	const telemetry = telemetryMiddleware(init);
	if (telemetry) client.use(telemetry);
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
			const timer = setTimeout(
				() => ac.abort(new Error(`Request timed out after ${timeoutMs}ms`)),
				timeoutMs,
			);
			existing?.addEventListener("abort", () => ac.abort(existing.reason), { once: true });
			const newReq = new Request(request, { signal: ac.signal });
			timers.set(newReq, timer);
			return newReq;
		},
		async onResponse({ request, response }) {
			const timer = timers.get(request);
			if (timer) {
				clearTimeout(timer);
				timers.delete(request);
			}
			return response;
		},
		async onError({ request }) {
			const timer = timers.get(request);
			if (timer) {
				clearTimeout(timer);
				timers.delete(request);
			}
		},
	};
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
		const signal: AbortSignal | undefined = init?.signal ?? undefined;
		let attempt = 0;
		while (attempt < opts.maxAttempts) {
			attempt += 1;
			try {
				const res = await baseFetch(input, init);
				if (!opts.retryableStatuses.has(res.status) || attempt >= opts.maxAttempts) return res;
				const retryAfter = parseRetryAfter(res.headers.get("retry-after"), opts.maxDelayMs);
				const delay = retryAfter ?? computeBackoffMs(attempt, opts);
				await sleep(delay, signal);
			} catch (err) {
				if (isAbortError(err)) throw err;
				if (!opts.retryOnNetworkError || attempt >= opts.maxAttempts) {
					const url =
						typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
					const method = init?.method ?? "GET";
					throw new TochkaNetworkError(
						`Network error after ${attempt} attempt(s): ${(err as Error).message}`,
						{ url, method, cause: err },
					);
				}
				await sleep(computeBackoffMs(attempt, opts), signal);
			}
		}
		throw new Error("makeRetryingFetch: unreachable — validateRetryOptions should prevent this");
	};
	return retrying as unknown as typeof fetch;
}
