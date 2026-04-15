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
}

export const DEFAULT_RETRY: RetryOptions = {
	maxAttempts: 3,
	initialDelayMs: 300,
	maxDelayMs: 8_000,
	factor: 2,
	jitter: true,
	retryableStatuses: new Set([408, 425, 429, 500, 502, 503, 504]),
	retryOnNetworkError: true,
};

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
	if (opts.maxDelayMs < 0 || opts.initialDelayMs < 0) {
		throw new Error("RetryOptions.*Delay must be non-negative");
	}
}
