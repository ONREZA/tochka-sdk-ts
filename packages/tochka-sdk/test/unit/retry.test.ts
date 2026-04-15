import { describe, expect, test } from "bun:test";
import {
	DEFAULT_RETRY,
	computeBackoffMs,
	isAbortError,
	parseRetryAfter,
	sleep,
	validateRetryOptions,
} from "../../src/core/retry.js";

const NO_JITTER = { ...DEFAULT_RETRY, jitter: false };

describe("computeBackoffMs", () => {
	test("первая попытка = initialDelayMs (без jitter)", () => {
		expect(computeBackoffMs(1, NO_JITTER)).toBe(300);
	});

	test("экспоненциальный рост с factor=2", () => {
		expect(computeBackoffMs(2, NO_JITTER)).toBe(600);
		expect(computeBackoffMs(3, NO_JITTER)).toBe(1200);
		expect(computeBackoffMs(4, NO_JITTER)).toBe(2400);
	});

	test("clamp на maxDelayMs", () => {
		expect(computeBackoffMs(10, NO_JITTER)).toBe(NO_JITTER.maxDelayMs);
		expect(computeBackoffMs(100, NO_JITTER)).toBe(NO_JITTER.maxDelayMs);
	});

	test("jitter не даёт отрицательных значений", () => {
		for (let i = 0; i < 100; i++) {
			const v = computeBackoffMs(1, DEFAULT_RETRY);
			expect(v).toBeGreaterThanOrEqual(0);
		}
	});

	test("jitter даёт ±25% вокруг base", () => {
		const base = computeBackoffMs(1, NO_JITTER);
		for (let i = 0; i < 50; i++) {
			const v = computeBackoffMs(1, DEFAULT_RETRY);
			expect(v).toBeGreaterThanOrEqual(base * 0.75);
			expect(v).toBeLessThanOrEqual(base * 1.25);
		}
	});
});

describe("parseRetryAfter", () => {
	test("null / пустая / мусор → null", () => {
		expect(parseRetryAfter(null)).toBe(null);
		expect(parseRetryAfter("")).toBe(null);
		expect(parseRetryAfter("not-a-number")).toBe(null);
	});

	test("число секунд умножается на 1000", () => {
		expect(parseRetryAfter("2")).toBe(2000);
		expect(parseRetryAfter("0")).toBe(0);
	});

	test("clamp по maxMs (дефолт 60с)", () => {
		expect(parseRetryAfter("3600")).toBe(60_000);
		expect(parseRetryAfter("120", 30_000)).toBe(30_000);
	});

	test("отрицательное число приводится к нулю", () => {
		expect(parseRetryAfter("-10")).toBe(0);
	});

	test("HTTP-date в будущем", () => {
		const future = new Date(Date.now() + 5_000).toUTCString();
		const result = parseRetryAfter(future);
		expect(result).not.toBe(null);
		expect(result).toBeGreaterThan(3_000);
		expect(result).toBeLessThanOrEqual(5_000);
	});

	test("HTTP-date в прошлом → 0", () => {
		expect(parseRetryAfter("Wed, 01 Jan 2020 00:00:00 GMT")).toBe(0);
	});
});

describe("sleep", () => {
	test("резолвится через ms", async () => {
		const start = performance.now();
		await sleep(30);
		expect(performance.now() - start).toBeGreaterThanOrEqual(25);
	});

	test("отменяется через signal", async () => {
		const ac = new AbortController();
		const p = sleep(1000, ac.signal);
		ac.abort();
		await expect(p).rejects.toThrow();
	});

	test("pre-aborted signal реджектит сразу", async () => {
		const ac = new AbortController();
		ac.abort();
		await expect(sleep(100, ac.signal)).rejects.toThrow();
	});
});

describe("isAbortError", () => {
	test("определяет DOMException Abort", () => {
		const err = new DOMException("Aborted", "AbortError");
		expect(isAbortError(err)).toBe(true);
	});

	test("определяет Error с name=AbortError", () => {
		const err = new Error("x");
		err.name = "AbortError";
		expect(isAbortError(err)).toBe(true);
	});

	test("обычная ошибка → false", () => {
		expect(isAbortError(new Error("boom"))).toBe(false);
		expect(isAbortError(new TypeError("x"))).toBe(false);
	});

	test("null/undefined/строка → false", () => {
		expect(isAbortError(null)).toBe(false);
		expect(isAbortError(undefined)).toBe(false);
		expect(isAbortError("AbortError")).toBe(false);
	});
});

describe("validateRetryOptions", () => {
	test("ок для валидных опций", () => {
		expect(() => validateRetryOptions(DEFAULT_RETRY)).not.toThrow();
	});

	test("падает при maxAttempts < 1", () => {
		expect(() => validateRetryOptions({ ...DEFAULT_RETRY, maxAttempts: 0 })).toThrow(
			/positive integer/,
		);
		expect(() => validateRetryOptions({ ...DEFAULT_RETRY, maxAttempts: -1 })).toThrow();
	});

	test("падает при нецелом maxAttempts", () => {
		expect(() => validateRetryOptions({ ...DEFAULT_RETRY, maxAttempts: 1.5 })).toThrow();
	});

	test("падает на отрицательные delay", () => {
		expect(() => validateRetryOptions({ ...DEFAULT_RETRY, initialDelayMs: -1 })).toThrow();
		expect(() => validateRetryOptions({ ...DEFAULT_RETRY, maxDelayMs: -1 })).toThrow();
	});
});
