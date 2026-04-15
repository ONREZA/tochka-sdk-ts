import { describe, expect, test } from "bun:test";
import { makeRetryingFetch } from "../../src/core/http.js";
import { DEFAULT_RETRY } from "../../src/core/retry.js";
import { TochkaNetworkError } from "../../src/errors/index.js";

function stubFetch(responses: Array<() => Response | Error>): {
	fetch: typeof fetch;
	calls: { n: number };
} {
	const calls = { n: 0 };
	const fetch = (async () => {
		const idx = calls.n;
		calls.n += 1;
		const factory = responses[Math.min(idx, responses.length - 1)];
		if (!factory) throw new Error("stubFetch: no response configured");
		const result = factory();
		if (result instanceof Error) throw result;
		return result;
	}) as typeof fetch;
	return { fetch, calls };
}

const FAST_RETRY = {
	...DEFAULT_RETRY,
	initialDelayMs: 5,
	maxDelayMs: 20,
	jitter: false,
};

describe("makeRetryingFetch", () => {
	test("успех с первой попытки — один вызов", async () => {
		const { fetch, calls } = stubFetch([() => new Response("ok", { status: 200 })]);
		const retrying = makeRetryingFetch(FAST_RETRY, fetch);
		const res = await retrying("http://x");
		expect(res.status).toBe(200);
		expect(calls.n).toBe(1);
	});

	test("503→200: retry и возврат второго ответа", async () => {
		const { fetch, calls } = stubFetch([
			() => new Response("busy", { status: 503 }),
			() => new Response("ok", { status: 200 }),
		]);
		const retrying = makeRetryingFetch(FAST_RETRY, fetch);
		const res = await retrying("http://x");
		expect(res.status).toBe(200);
		expect(calls.n).toBe(2);
	});

	test("все попытки 503 — возвращается последний Response", async () => {
		const { fetch, calls } = stubFetch([() => new Response("", { status: 503 })]);
		const retrying = makeRetryingFetch({ ...FAST_RETRY, maxAttempts: 3 }, fetch);
		const res = await retrying("http://x");
		expect(res.status).toBe(503);
		expect(calls.n).toBe(3);
	});

	test("non-retryable 404 — немедленный возврат без retry", async () => {
		const { fetch, calls } = stubFetch([() => new Response("nope", { status: 404 })]);
		const retrying = makeRetryingFetch(FAST_RETRY, fetch);
		const res = await retrying("http://x");
		expect(res.status).toBe(404);
		expect(calls.n).toBe(1);
	});

	test("сетевая ошибка при retryOnNetworkError: true — retry", async () => {
		const { fetch, calls } = stubFetch([
			() => new TypeError("fetch failed"),
			() => new Response("ok", { status: 200 }),
		]);
		const retrying = makeRetryingFetch(FAST_RETRY, fetch);
		const res = await retrying("http://x");
		expect(res.status).toBe(200);
		expect(calls.n).toBe(2);
	});

	test("сетевая ошибка после exhausted — TochkaNetworkError", async () => {
		const { fetch, calls } = stubFetch([() => new TypeError("fetch failed")]);
		const retrying = makeRetryingFetch({ ...FAST_RETRY, maxAttempts: 2 }, fetch);
		try {
			await retrying("http://x");
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(TochkaNetworkError);
			expect((err as Error).message).toContain("2 attempt");
		}
		expect(calls.n).toBe(2);
	});

	test("retryOnNetworkError: false — первая же ошибка поднимается", async () => {
		const { fetch, calls } = stubFetch([() => new TypeError("fetch failed")]);
		const retrying = makeRetryingFetch({ ...FAST_RETRY, retryOnNetworkError: false }, fetch);
		await expect(retrying("http://x")).rejects.toBeInstanceOf(TochkaNetworkError);
		expect(calls.n).toBe(1);
	});

	test("AbortError никогда не ретраится", async () => {
		const err = new DOMException("Aborted", "AbortError");
		const { fetch, calls } = stubFetch([() => err]);
		const retrying = makeRetryingFetch(FAST_RETRY, fetch);
		await expect(retrying("http://x")).rejects.toBe(err);
		expect(calls.n).toBe(1);
	});

	test("Retry-After header используется вместо backoff", async () => {
		const { fetch, calls } = stubFetch([
			() => new Response("", { status: 429, headers: { "Retry-After": "0" } }),
			() => new Response("ok", { status: 200 }),
		]);
		const retrying = makeRetryingFetch(FAST_RETRY, fetch);
		const start = Date.now();
		const res = await retrying("http://x");
		expect(res.status).toBe(200);
		expect(calls.n).toBe(2);
		// Retry-After: 0 → sleep 0, быстрее чем backoff (5мс)
		expect(Date.now() - start).toBeLessThan(50);
	});

	test("maxAttempts=0 → падает в validateRetryOptions", () => {
		expect(() => makeRetryingFetch({ ...FAST_RETRY, maxAttempts: 0 })).toThrow();
	});
});
