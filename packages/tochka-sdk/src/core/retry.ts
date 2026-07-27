export interface RetryOptions {
	/** Макс. число попыток, включая первую. Должно быть >= 1. */
	maxAttempts: number;
	/** Начальная задержка в мс. */
	initialDelayMs: number;
	/** Потолок задержки в мс. Применяется и к вычисленному backoff, и к Retry-After. */
	maxDelayMs: number;
	/** Множитель экспоненциального backoff. */
	factor: number;
	/** Добавлять jitter ±25%. */
	jitter: boolean;
	/** Статусы, на которые ретраим. */
	retryableStatuses: ReadonlySet<number>;
	/** Ретраить ли сетевые ошибки (без ответа от сервера). */
	retryOnNetworkError: boolean;
	/**
	 * HTTP-методы, которые разрешено повторять автоматически.
	 * Mutating-методы добавляйте только при подтверждённой server-side idempotency.
	 */
	retryableMethods: ReadonlySet<string>;
}

const DEFAULT_RETRYABLE_STATUSES = [408, 425, 429, 500, 502, 503, 504] as const;
const DEFAULT_RETRYABLE_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

export const DEFAULT_RETRY: RetryOptions = Object.freeze({
	maxAttempts: 3,
	initialDelayMs: 300,
	maxDelayMs: 8_000,
	factor: 2,
	jitter: true,
	retryableStatuses: new Set(DEFAULT_RETRYABLE_STATUSES),
	retryOnNetworkError: true,
	retryableMethods: new Set(DEFAULT_RETRYABLE_METHODS),
});

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function resolveRetryOptions(overrides: Partial<RetryOptions> = {}): RetryOptions {
	const resolved: RetryOptions = {
		maxAttempts: overrides.maxAttempts ?? DEFAULT_RETRY.maxAttempts,
		initialDelayMs: overrides.initialDelayMs ?? DEFAULT_RETRY.initialDelayMs,
		maxDelayMs: overrides.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs,
		factor: overrides.factor ?? DEFAULT_RETRY.factor,
		jitter: overrides.jitter ?? DEFAULT_RETRY.jitter,
		retryableStatuses: new Set(overrides.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES),
		retryOnNetworkError: overrides.retryOnNetworkError ?? DEFAULT_RETRY.retryOnNetworkError,
		retryableMethods: new Set(overrides.retryableMethods ?? DEFAULT_RETRYABLE_METHODS),
	};
	validateRetryOptions(resolved);
	return resolved;
}

export function isReadOnlyMethod(method: string): boolean {
	return READ_ONLY_METHODS.has(method.toUpperCase());
}

export function isRetryableMethod(method: string, opts: RetryOptions): boolean {
	const normalized = method.toUpperCase();
	for (const configured of opts.retryableMethods) {
		if (configured.toUpperCase() === normalized) return true;
	}
	return false;
}

export function computeBackoffMs(attempt: number, opts: RetryOptions): number {
	const base = Math.min(opts.maxDelayMs, opts.initialDelayMs * opts.factor ** (attempt - 1));
	if (!opts.jitter) return base;
	const spread = base * 0.25;
	return Math.max(0, base - spread + Math.random() * spread * 2);
}

/**
 * Разобрать заголовок `Retry-After`. Поддерживает HTTP-date и относительные
 * секунды. Clamp до `maxMs` чтобы сервер/прокси не могли заморозить вызывающую
 * сторону на час.
 */
export function parseRetryAfter(header: string | null, maxMs = 60_000): number | null {
	if (!header) return null;
	const asNum = Number(header);
	if (Number.isFinite(asNum)) return Math.min(maxMs, Math.max(0, asNum * 1000));
	const asDate = Date.parse(header);
	if (Number.isFinite(asDate)) return Math.min(maxMs, Math.max(0, asDate - Date.now()));
	return null;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
			return;
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

/** `true` если ошибка — результат `AbortController.abort()` от пользователя. */
export function isAbortError(err: unknown): boolean {
	if (err instanceof Error && err.name === "AbortError") return true;
	if (typeof err === "object" && err !== null && "name" in err) {
		return (err as { name?: string }).name === "AbortError";
	}
	return false;
}

export function validateRetryOptions(opts: RetryOptions): void {
	if (!Number.isInteger(opts.maxAttempts) || opts.maxAttempts < 1) {
		throw new Error(`RetryOptions.maxAttempts must be a positive integer, got ${opts.maxAttempts}`);
	}
	if (
		!Number.isFinite(opts.maxDelayMs) ||
		opts.maxDelayMs < 0 ||
		!Number.isFinite(opts.initialDelayMs) ||
		opts.initialDelayMs < 0
	) {
		throw new Error("RetryOptions.*Delay must be finite and non-negative");
	}
	if (!Number.isFinite(opts.factor) || opts.factor <= 0) {
		throw new Error("RetryOptions.factor must be a positive finite number");
	}
	for (const status of opts.retryableStatuses) {
		if (!Number.isInteger(status) || status < 100 || status > 599) {
			throw new Error(`RetryOptions.retryableStatuses contains invalid HTTP status: ${status}`);
		}
	}
	for (const method of opts.retryableMethods) {
		if (method.trim() === "") {
			throw new Error("RetryOptions.retryableMethods must not contain an empty method");
		}
	}
}
