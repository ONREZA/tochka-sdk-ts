import { describe, expect, test } from "bun:test";
import { buildFetchClient } from "../../src/core/http.js";

describe("buildFetchClient", () => {
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
			}) as typeof fetch,
			onResponse: (info) => {
				durationMs = info.durationMs;
			},
		});

		await client.GET("/open-banking/v1.0/accounts");

		expect(durationMs).toBeGreaterThanOrEqual(20);
	});
});
