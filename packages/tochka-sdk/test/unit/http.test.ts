import { describe, expect, test } from "bun:test";
import { OAuthClient } from "../../src/auth/oauth-client.js";
import { TochkaClient } from "../../src/client.js";
import { PayGatewayClient } from "../../src/pay-gateway/index.js";
import { buildFetchClient, makeRetryingFetch } from "../../src/core/http.js";
import { resolveRetryOptions } from "../../src/core/retry.js";
import { TochkaNetworkError, TochkaUnknownOutcomeError } from "../../src/errors/index.js";

describe("buildFetchClient", () => {
	test.each([
		(timeoutMs: number) => new TochkaClient({ auth: { sandbox: true }, timeoutMs }),
		(timeoutMs: number) => new OAuthClient({ clientId: "cid", clientSecret: "secret", timeoutMs }),
		(timeoutMs: number) =>
			new PayGatewayClient({ token: "jwt", baseUrl: "https://pay.example", timeoutMs }),
		(timeoutMs: number) =>
			buildFetchClient({
				auth: { getHeaders: () => ({}) },
				baseUrl: "https://api.example",
				timeoutMs,
			}),
	])(
		"validates native timer bounds at construction while preserving disabled zero",
		(construct) => {
			for (const timeoutMs of [-1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648]) {
				expect(() => construct(timeoutMs)).toThrow();
			}
			expect(() => construct(0)).not.toThrow();
			expect(() => construct(2_147_483_647)).not.toThrow();
		},
	);

	test.each([429, 503])(
		"retains HTTP %d error details when Retry-After stops retries",
		async (status) => {
			let calls = 0;
			const client = buildFetchClient({
				baseUrl: "https://api.example.test",
				auth: { getHeaders: () => ({}) },
				fetch: makeRetryingFetch(resolveRetryOptions({ maxDelayMs: 20 }), (async () => {
					calls++;
					return Response.json(
						{ message: "OPERATION_RATE_LIMIT" },
						{ status, headers: { "Retry-After": "3600", "x-request-id": "provider-id" } },
					);
				}) as unknown as typeof globalThis.fetch),
			});
			await expect(client.GET("/open-banking/v1.0/accounts")).rejects.toMatchObject({
				status,
				retryAfterMs: 3_600_000,
				requestId: "provider-id",
				category: "OPERATION_RATE_LIMIT",
			});
			expect(calls).toBe(1);
		},
	);

	test("a pre-aborted write is never sent with a fresh timeout signal", async () => {
		let calls = 0;
		const reason = new Error("cancelled before dispatch");
		const client = buildFetchClient({
			baseUrl: "https://api.example.test",
			auth: { getHeaders: () => ({}) },
			timeoutMs: 20,
			fetch: (async () => {
				calls += 1;
				return Response.json({});
			}) as unknown as typeof globalThis.fetch,
		});
		await expect(
			client.POST("/acquiring/v1.0/payments/{operationId}/capture", {
				params: { path: { operationId: "p" } },
				signal: AbortSignal.abort(reason),
			}),
		).rejects.toBe(reason);
		expect(calls).toBe(0);
	});
	for (const write of [false, true]) {
		test(`${write ? "POST" : "GET"}: timeout remains active while reading JSON`, async () => {
			const client = buildFetchClient({
				baseUrl: "https://api.example.test",
				auth: { getHeaders: () => ({}) },
				timeoutMs: 5,
				fetch: (async (input: RequestInfo | URL) => {
					const request = input as Request;
					return new Response(
						new ReadableStream({
							start(controller) {
								const timer = setTimeout(() => {
									controller.enqueue(new TextEncoder().encode("{}"));
									controller.close();
								}, 30);
								request.signal.addEventListener(
									"abort",
									() => {
										clearTimeout(timer);
										controller.error(request.signal.reason);
									},
									{ once: true },
								);
							},
						}),
					);
				}) as unknown as typeof globalThis.fetch,
			});
			const operation = write
				? client.POST("/acquiring/v1.0/payments/{operationId}/capture", {
						params: { path: { operationId: "p" } },
					})
				: client.GET("/open-banking/v1.0/accounts");
			await expect(operation).rejects.toBeInstanceOf(
				write ? TochkaUnknownOutcomeError : TochkaNetworkError,
			);
		});
	}

	test("timeout bounds a stalled HTTP error body while retaining its status", async () => {
		let aborted = false;
		const client = buildFetchClient({
			baseUrl: "https://api.example.test",
			auth: { getHeaders: () => ({}) },
			timeoutMs: 5,
			fetch: (async (input: RequestInfo | URL) => {
				const request = input as Request;
				return new Response(
					new ReadableStream({
						start(controller) {
							const timer = setTimeout(() => controller.close(), 30);
							request.signal.addEventListener(
								"abort",
								() => {
									aborted = true;
									clearTimeout(timer);
									controller.error(request.signal.reason);
								},
								{ once: true },
							);
						},
					}),
					{ status: 503 },
				);
			}) as unknown as typeof globalThis.fetch,
		});
		await expect(client.GET("/open-banking/v1.0/accounts")).rejects.toMatchObject({ status: 503 });
		expect(aborted).toBe(true);
	});

	test("stream parsing returns before body completion and cancel cleans up the deadline", async () => {
		let aborted = false;
		let cancelled = false;
		const client = buildFetchClient({
			baseUrl: "https://api.example.test",
			auth: { getHeaders: () => ({}) },
			timeoutMs: 20,
			fetch: (async (input: RequestInfo | URL) => {
				(input as Request).signal.addEventListener("abort", () => {
					aborted = true;
				});
				const response = new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(new Uint8Array([1]));
						},
						cancel() {
							cancelled = true;
						},
					}),
				);
				Object.defineProperties(response, {
					url: { value: "https://api.example.test/redirected" },
					redirected: { value: true },
				});
				return response;
			}) as unknown as typeof globalThis.fetch,
		});
		const result = await client.GET("/open-banking/v1.0/accounts", { parseAs: "stream" });
		expect(result.response.url).toBe("https://api.example.test/redirected");
		expect(result.response.redirected).toBe(true);
		const cloned = result.response.clone();
		expect(cloned.url).toBe(result.response.url);
		expect(cloned.redirected).toBe(true);
		expect(aborted).toBe(false);
		expect(result.data).toBeInstanceOf(ReadableStream);
		const stream = result.response.body as ReadableStream<Uint8Array>;
		const reader = stream.getReader();
		expect((await reader.read()).value).toEqual(new Uint8Array([1]));
		await Promise.all([reader.cancel(), cloned.body?.cancel()]);
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(cancelled).toBe(true);
		expect(aborted).toBe(false);
	});

	test("telemetry измеряет запрос после установки timeout signal", async () => {
		let durationMs: number | undefined;
		const client = buildFetchClient({
			baseUrl: "https://api.example.test",
			auth: { getHeaders: () => ({}) },
			timeoutMs: 1_000,
			fetch: (async () => {
				await new Promise((resolve) => setTimeout(resolve, 30));
				return new Response("{}", {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}) as unknown as typeof globalThis.fetch,
			onResponse: (info) => {
				durationMs = info.durationMs;
			},
		});

		await client.GET("/open-banking/v1.0/accounts");

		expect(durationMs).toBeGreaterThanOrEqual(20);
	});
});
