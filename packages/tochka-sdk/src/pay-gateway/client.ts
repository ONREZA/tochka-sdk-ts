import {
	computeBackoffMs,
	isAbortError,
	isReadOnlyMethod,
	isRetryableMethod,
	parseRetryAfter,
	type RetryOptions,
	resolveRetryOptions,
	sleep,
} from "../core/retry.js";
import {
	TochkaError,
	type TochkaErrorPayload,
	TochkaNetworkError,
	TochkaUnknownOutcomeError,
} from "../errors/index.js";
import { type BodySigner, createBodySigner, type PrivateKeyInput } from "./signature.js";

export interface PayGatewayClientOptions {
	/** JWT-токен авторизации (Authorization: Bearer). */
	token: string;
	/**
	 * Origin без path/query. Выдаётся Точкой при онбординге и должен включать
	 * scheme (`https://`); `/uapi/pay/...` SDK добавляет сам.
	 */
	baseUrl: string;
	/**
	 * Приватный ключ для RSA-SHA256 подписи тела запросов. Формат — PKCS#8 PEM
	 * (или готовый `CryptoKey`). Обязателен для методов `create/capture/refund`.
	 */
	privateKey?: PrivateKeyInput;
	/** Дополнительные заголовки. */
	headers?: Record<string, string>;
	fetch?: typeof fetch;
	userAgent?: string;
	timeoutMs?: number;
	/**
	 * Настройки ретраев. По умолчанию повторяются только read-only методы.
	 * Mutating-методы можно добавить в `retryableMethods` только при наличии
	 * подтверждённой server-side idempotency.
	 */
	retry?: Partial<RetryOptions> | false;
	/**
	 * HTTP-методы + пути (regexp или строка), для которых SDK обязан подписать тело.
	 * По умолчанию — создание платежа (`POST .../payments`), подтверждение
	 * (`POST .../payments/{id}/captures`) и возврат
	 * (`POST .../payments/{id}/refunds`).
	 */
	signedPaths?: readonly (string | RegExp)[];
}

export const DEFAULT_SIGNED_PATHS: readonly (string | RegExp)[] = Object.freeze([
	/\/payments(?:\?|$)/,
	/\/captures(?:\?|$)/,
	/\/refunds(?:\?|$)/,
]);

export class PayGatewayClient {
	private readonly opts: PayGatewayClientOptions;
	private readonly baseUrl: string;
	private readonly retryOpts: RetryOptions | null;
	private readonly retryOptsForSigned: RetryOptions | null;
	private signerPromise: Promise<BodySigner> | null = null;

	constructor(opts: PayGatewayClientOptions) {
		if (!opts.token) throw new Error("PayGatewayClient: token is required");
		if (!opts.baseUrl) throw new Error("PayGatewayClient: baseUrl is required");
		let baseUrl: URL;
		try {
			baseUrl = new URL(opts.baseUrl);
		} catch {
			throw new Error(`PayGatewayClient: baseUrl is not a valid URL: ${opts.baseUrl}`);
		}
		if (!["http:", "https:"].includes(baseUrl.protocol)) {
			throw new Error("PayGatewayClient: baseUrl must use http or https");
		}
		if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
			throw new Error("PayGatewayClient: baseUrl must not contain credentials, query, or fragment");
		}
		if (baseUrl.pathname !== "/" && baseUrl.pathname !== "") {
			throw new Error("PayGatewayClient: baseUrl must be an origin without a path");
		}
		if (opts.timeoutMs !== undefined && (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 0)) {
			throw new Error("PayGatewayClient: timeoutMs must be finite and non-negative");
		}
		for (const pattern of opts.signedPaths ?? []) {
			if (pattern instanceof RegExp && (pattern.global || pattern.sticky)) {
				throw new Error("PayGatewayClient: signedPaths RegExp must not use g or y flags");
			}
		}
		this.opts = {
			...opts,
			...(opts.headers ? { headers: { ...opts.headers } } : {}),
			...(opts.signedPaths ? { signedPaths: [...opts.signedPaths] } : {}),
		};
		this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
		if (opts.retry === false) {
			this.retryOpts = null;
			this.retryOptsForSigned = null;
		} else {
			const merged = resolveRetryOptions(opts.retry);
			this.retryOpts = merged;
			// Даже при явном opt-in mutating-метода подписанные запросы не повторяем
			// после сетевой ошибки: банк мог применить операцию до разрыва соединения.
			this.retryOptsForSigned = { ...merged, retryOnNetworkError: false };
		}
	}

	/**
	 * Низкоуровневый запрос. Подпись Signature добавляется автоматически для
	 * путей из `signedPaths`.
	 *
	 * **Идемпотентность:** mutating-пути не ретраятся по умолчанию. После
	 * транспортной ошибки SDK бросает `TochkaUnknownOutcomeError`.
	 */
	async request<T = unknown>(
		method: string,
		path: string,
		body?: unknown,
		init: { headers?: Record<string, string>; signal?: AbortSignal } = {},
	): Promise<T> {
		const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
		const upperMethod = method.toUpperCase();
		const headers: Record<string, string> = {
			Accept: "application/json",
			"User-Agent": this.opts.userAgent ?? "onreza-tochka-sdk",
			...(this.opts.headers ?? {}),
			...(init.headers ?? {}),
			Authorization: `Bearer ${this.opts.token}`,
		};

		let serialized: string | undefined;
		if (body !== undefined) {
			serialized = typeof body === "string" ? body : JSON.stringify(body);
			headers["Content-Type"] ??= "application/json";
		}

		const isSigned = this.shouldSign(upperMethod, path);
		if (isSigned) {
			if (!this.opts.privateKey) {
				throw new Error(
					`PayGateway: ${upperMethod} ${path} requires signed body, but privateKey is not configured`,
				);
			}
			if (serialized === undefined) {
				throw new Error(`PayGateway: ${upperMethod} ${path} requires a body for signing`);
			}
			const signer = await this.getSigner();
			headers.Signature = await signer.sign(serialized);
		}

		const baseFetch = this.opts.fetch ?? fetch;
		const response = await this.doRequest(baseFetch, url, {
			method: upperMethod,
			headers,
			...(serialized !== undefined ? { body: serialized } : {}),
			...(init.signal !== undefined ? { signal: init.signal } : {}),
			...(this.opts.timeoutMs !== undefined ? { timeoutMs: this.opts.timeoutMs } : {}),
			retry: isSigned ? this.retryOptsForSigned : this.retryOpts,
		});

		const text = await response.text();
		const trimmed = text.trim();
		let parsed: unknown;
		if (trimmed === "") {
			parsed = undefined;
		} else if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			try {
				parsed = JSON.parse(text);
			} catch (err) {
				if (response.ok) {
					throw new TochkaNetworkError(
						`PayGateway: malformed JSON response from ${url} (HTTP ${response.status}): ${(err as Error).message}`,
						{ url, method: upperMethod, cause: err },
					);
				}
				parsed = text;
			}
		} else {
			parsed = text;
		}

		if (!response.ok) {
			throw TochkaError.from({
				status: response.status,
				url,
				method: upperMethod,
				payload: parsed && typeof parsed === "object" ? (parsed as TochkaErrorPayload) : undefined,
				rawBody: text,
			});
		}
		if (response.ok && parsed !== undefined && typeof parsed !== "object") {
			throw new TochkaNetworkError(
				`PayGateway: expected JSON object on 2xx, got ${typeof parsed} (status ${response.status})`,
				{ url, method: upperMethod },
			);
		}
		// Успешные ответы pay-gateway приходят в Open Banking-конверте
		// `{ Data, Links, Meta }` (см. примеры create-payment / get-payment в доках).
		// Возвращаем полезную нагрузку из `Data`; ответы без конверта (если такие
		// есть) пропускаем как есть. Ответы-ошибки сюда не доходят — они плоские и
		// обрабатываются выше через `TochkaError.from`.
		if (parsed && typeof parsed === "object" && "Data" in (parsed as object)) {
			return (parsed as { Data: unknown }).Data as T;
		}
		return parsed as T;
	}

	private shouldSign(method: string, path: string): boolean {
		if (isReadOnlyMethod(method)) return false;
		const patterns = this.opts.signedPaths ?? DEFAULT_SIGNED_PATHS;
		return patterns.some((pat) => (typeof pat === "string" ? path.includes(pat) : pat.test(path)));
	}

	private getSigner(): Promise<BodySigner> {
		if (!this.opts.privateKey) {
			throw new Error("PayGateway: privateKey is required for signed endpoints");
		}
		if (!this.signerPromise) {
			this.signerPromise = createBodySigner(this.opts.privateKey).catch((err) => {
				this.signerPromise = null;
				throw err;
			});
		}
		return this.signerPromise;
	}

	private async doRequest(
		fetchImpl: typeof fetch,
		url: string,
		opts: {
			method: string;
			headers: Record<string, string>;
			body?: string;
			signal?: AbortSignal;
			timeoutMs?: number;
			retry: RetryOptions | null;
		},
	): Promise<Response> {
		if (opts.signal?.aborted) {
			throw opts.signal.reason ?? new DOMException("Aborted", "AbortError");
		}
		const retry = opts.retry;
		const mayRetry = retry ? isRetryableMethod(opts.method, retry) : false;
		const maxAttempts = retry && mayRetry ? retry.maxAttempts : 1;
		let attempt = 0;
		while (attempt < maxAttempts) {
			attempt += 1;
			const ac = new AbortController();
			const timer = opts.timeoutMs
				? setTimeout(
						() => ac.abort(new Error(`Request timed out after ${opts.timeoutMs}ms`)),
						opts.timeoutMs,
					)
				: null;
			const forwardAbort = () => ac.abort(opts.signal?.reason);
			opts.signal?.addEventListener("abort", forwardAbort, { once: true });
			let response: Response;
			try {
				response = await fetchImpl(url, {
					method: opts.method,
					headers: opts.headers,
					...(opts.body !== undefined ? { body: opts.body } : {}),
					signal: ac.signal,
				});
			} catch (err) {
				const aborted = isAbortError(err) || ac.signal.aborted || opts.signal?.aborted;
				if (aborted || !retry || !retry.retryOnNetworkError || attempt >= maxAttempts) {
					const message = `PayGateway network error after ${attempt} attempt(s): ${(err as Error).message}`;
					const details = { url, method: opts.method, cause: err };
					if (opts.signal?.aborted && isReadOnlyMethod(opts.method)) {
						throw opts.signal.reason ?? err;
					}
					throw isReadOnlyMethod(opts.method)
						? new TochkaNetworkError(message, details)
						: new TochkaUnknownOutcomeError(
								`${message}. The operation outcome is unknown; do not retry without idempotency.`,
								details,
							);
				}
				await sleep(computeBackoffMs(attempt, retry), opts.signal);
				continue;
			} finally {
				if (timer) clearTimeout(timer);
				opts.signal?.removeEventListener("abort", forwardAbort);
			}
			if (!retry?.retryableStatuses.has(response.status) || attempt >= maxAttempts) {
				return response;
			}
			const retryAfter = parseRetryAfter(response.headers.get("retry-after"), retry.maxDelayMs);
			await response.body?.cancel().catch(() => undefined);
			await sleep(retryAfter ?? computeBackoffMs(attempt, retry), opts.signal);
		}
		throw new Error("PayGatewayClient.doRequest: unreachable");
	}
}
