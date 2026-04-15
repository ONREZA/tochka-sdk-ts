import {
	DEFAULT_RETRY,
	type RetryOptions,
	computeBackoffMs,
	isAbortError,
	parseRetryAfter,
	sleep,
	validateRetryOptions,
} from "../core/retry.js";
import { TochkaError, TochkaNetworkError } from "../errors/index.js";
import { type BodySigner, type PrivateKeyInput, createBodySigner } from "./signature.js";

export interface PayGatewayClientOptions {
	/** JWT-токен авторизации (Authorization: Bearer). */
	token: string;
	/** Базовый URL. Выдаётся Точкой при онбординге. Должен включать scheme (`https://`). */
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
	 * Настройки ретраев для всех путей, КРОМЕ подписанных (mutating).
	 * По умолчанию — без ретрая на сетевые ошибки для подписанных путей,
	 * т.к. без серверной идемпотентности повтор даст двойное списание.
	 */
	retry?: Partial<RetryOptions> | false;
	/**
	 * HTTP-методы + пути (regexp или строка), для которых SDK обязан подписать тело.
	 * По умолчанию — `POST /create-payment`, `/create-capture`, `/create-refund`.
	 */
	signedPaths?: Array<string | RegExp>;
}

export const DEFAULT_SIGNED_PATHS: Array<string | RegExp> = [
	/\/create-payment(\b|$)/,
	/\/create-capture(\b|$)/,
	/\/create-refund(\b|$)/,
];

export class PayGatewayClient {
	private readonly opts: PayGatewayClientOptions;
	private readonly baseUrl: string;
	private readonly retryOpts: RetryOptions | null;
	private readonly retryOptsForSigned: RetryOptions | null;
	private signerPromise: Promise<BodySigner> | null = null;

	constructor(opts: PayGatewayClientOptions) {
		if (!opts.token) throw new Error("PayGatewayClient: token is required");
		if (!opts.baseUrl) throw new Error("PayGatewayClient: baseUrl is required");
		try {
			new URL(opts.baseUrl);
		} catch {
			throw new Error(`PayGatewayClient: baseUrl is not a valid URL: ${opts.baseUrl}`);
		}
		this.opts = opts;
		this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
		if (opts.retry === false) {
			this.retryOpts = null;
			this.retryOptsForSigned = null;
		} else {
			const merged = { ...DEFAULT_RETRY, ...(opts.retry ?? {}) };
			validateRetryOptions(merged);
			this.retryOpts = merged;
			// На подписанных путях без Idempotency-Key на стороне сервера retry
			// сетевых ошибок может привести к двойному списанию. Безопасный дефолт —
			// не ретраить сетевые ошибки; 5xx-retry оставляем только если включён явно.
			this.retryOptsForSigned = { ...merged, retryOnNetworkError: false };
		}
	}

	/**
	 * Низкоуровневый запрос. Подпись Signature добавляется автоматически для
	 * путей из `signedPaths`.
	 *
	 * **Идемпотентность:** для подписанных путей (`create-payment` и пр.) SDK
	 * НЕ ретраит на сетевую ошибку — повтор без server-side идемпотентности
	 * опасен. Передавайте стабильный `orderUid`/`agentRefundRequestId` в body,
	 * если хотите повторять вручную.
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
			Authorization: `Bearer ${this.opts.token}`,
			Accept: "application/json",
			"User-Agent": this.opts.userAgent ?? "onreza-tochka-sdk",
			...(this.opts.headers ?? {}),
			...(init.headers ?? {}),
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
				throw new TochkaNetworkError(
					`PayGateway: malformed JSON response from ${url} (HTTP ${response.status}): ${(err as Error).message}`,
					{ url, method: upperMethod, cause: err },
				);
			}
		} else {
			parsed = text;
		}

		if (!response.ok) {
			throw TochkaError.from({
				status: response.status,
				url,
				method: upperMethod,
				payload:
					parsed && typeof parsed === "object"
						? (parsed as { code?: number; message?: string; Errors?: [] })
						: undefined,
				rawBody: text,
			});
		}
		if (response.ok && parsed !== undefined && typeof parsed !== "object") {
			throw new TochkaNetworkError(
				`PayGateway: expected JSON object on 2xx, got ${typeof parsed} (status ${response.status})`,
				{ url, method: upperMethod },
			);
		}
		return parsed as T;
	}

	private shouldSign(method: string, path: string): boolean {
		if (method === "GET" || method === "DELETE") return false;
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
		const retry = opts.retry;
		const maxAttempts = retry ? retry.maxAttempts : 1;
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
			try {
				const res = await fetchImpl(url, {
					method: opts.method,
					headers: opts.headers,
					...(opts.body !== undefined ? { body: opts.body } : {}),
					signal: ac.signal,
				});
				if (!retry || !retry.retryableStatuses.has(res.status) || attempt >= maxAttempts) {
					return res;
				}
				const retryAfter = parseRetryAfter(res.headers.get("retry-after"), retry.maxDelayMs);
				await sleep(retryAfter ?? computeBackoffMs(attempt, retry), opts.signal);
			} catch (err) {
				if (isAbortError(err) || opts.signal?.aborted) throw err;
				if (!retry || !retry.retryOnNetworkError || attempt >= maxAttempts) {
					throw new TochkaNetworkError(
						`PayGateway network error after ${attempt} attempt(s): ${(err as Error).message}`,
						{ url, method: opts.method, cause: err },
					);
				}
				await sleep(computeBackoffMs(attempt, retry), opts.signal);
			} finally {
				if (timer) clearTimeout(timer);
				opts.signal?.removeEventListener("abort", forwardAbort);
			}
		}
		throw new Error("PayGatewayClient.doRequest: unreachable");
	}
}
