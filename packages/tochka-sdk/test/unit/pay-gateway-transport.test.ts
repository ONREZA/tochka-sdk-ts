import { expect, test } from "bun:test";
import { TochkaNetworkError, TochkaUnknownOutcomeError } from "../../src/errors/index.js";
import { PayGatewayClient } from "../../src/pay-gateway/index.js";

const keypair = crypto.subtle.generateKey(
	{
		name: "RSASSA-PKCS1-v1_5",
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: "SHA-256",
	},
	false,
	["sign", "verify"],
) as Promise<CryptoKeyPair>;

for (const method of ["GET", "POST", "PUT", "DELETE"] as const) {
	const path = `/uapi/pay/v1.0/sites/s/payments/p/refunds/r/${method === "POST" ? "retry" : "retry-form"}`;
	const body =
		method === "POST"
			? {
					Data: {
						refundMethod: {
							type: "CARD",
							pan: "4111111111111111",
							cvv2: "123",
							expirationDate: "12/28",
						},
					},
				}
			: undefined;
	test(`${method}: response-body failure retains network/unknown-outcome semantics`, async () => {
		let calls = 0;
		const client = new PayGatewayClient({
			token: "jwt",
			baseUrl: "https://pay.example",
			privateKey: (await keypair).privateKey,
			retry: { initialDelayMs: 0, maxDelayMs: 0, retryableMethods: new Set(["GET", "POST"]) },
			fetch: (async () => {
				calls += 1;
				return new Response(
					new ReadableStream({
						start(controller) {
							controller.error(new TypeError("connection reset"));
						},
					}),
				);
			}) as typeof fetch,
		});
		await expect(client.request(method, path, body)).rejects.toBeInstanceOf(
			method === "GET" ? TochkaNetworkError : TochkaUnknownOutcomeError,
		);
		expect(calls).toBe(method === "GET" ? 3 : 1);
	});

	test(`${method}: timeout covers the streamed response body`, async () => {
		const client = new PayGatewayClient({
			token: "jwt",
			baseUrl: "https://pay.example",
			privateKey: (await keypair).privateKey,
			timeoutMs: 5,
			fetch: (async (_url, init) =>
				new Response(
					new ReadableStream({
						start(controller) {
							const timer = setTimeout(() => controller.close(), 30);
							init?.signal?.addEventListener(
								"abort",
								() => {
									clearTimeout(timer);
									controller.error(init.signal?.reason);
								},
								{ once: true },
							);
						},
					}),
				)) as typeof fetch,
		});
		await expect(client.request(method, path, body)).rejects.toBeInstanceOf(
			method === "GET" ? TochkaNetworkError : TochkaUnknownOutcomeError,
		);
	});
}

test("malformed 2xx after a refund form mutation has an unknown outcome", async () => {
	for (const body of ['{"Data":', "upstream response truncated"]) {
		const client = new PayGatewayClient({
			token: "jwt",
			baseUrl: "https://pay.example",
			fetch: (async () => new Response(body)) as typeof fetch,
		});
		await expect(client.payments.createRefundRetryForm("s", "p", "r")).rejects.toBeInstanceOf(
			TochkaUnknownOutcomeError,
		);
	}
});

test("empty 200 after a refund form mutation has an unknown outcome", async () => {
	const client = new PayGatewayClient({
		token: "jwt",
		baseUrl: "https://pay.example",
		fetch: (async () => new Response("")) as typeof fetch,
	});
	await expect(client.payments.createRefundRetryForm("s", "p", "r")).rejects.toBeInstanceOf(
		TochkaUnknownOutcomeError,
	);
});

test("DELETE with a legitimate empty 204 response remains void", async () => {
	const client = new PayGatewayClient({
		token: "jwt",
		baseUrl: "https://pay.example",
		fetch: (async () => new Response(null, { status: 204 })) as typeof fetch,
	});
	expect(await client.payments.deleteRefundRetryForm("s", "p", "r")).toBeUndefined();
});
