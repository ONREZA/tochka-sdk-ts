import { expect, spyOn, test } from "bun:test";
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
			}) as unknown as typeof globalThis.fetch,
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
			fetch: (async (_url: RequestInfo | URL, init?: RequestInit) =>
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
				)) as unknown as typeof globalThis.fetch,
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
			fetch: (async () => new Response(body)) as unknown as typeof globalThis.fetch,
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
		fetch: (async () => new Response("")) as unknown as typeof globalThis.fetch,
	});
	await expect(client.payments.createRefundRetryForm("s", "p", "r")).rejects.toBeInstanceOf(
		TochkaUnknownOutcomeError,
	);
});

test("DELETE with a legitimate empty 204 response remains void", async () => {
	const client = new PayGatewayClient({
		token: "jwt",
		baseUrl: "https://pay.example",
		fetch: (async () => new Response(null, { status: 204 })) as unknown as typeof globalThis.fetch,
	});
	expect(await client.payments.deleteRefundRetryForm("s", "p", "r")).toBeUndefined();
});

for (const status of [429, 503]) {
	test(`PayGateway: HTTP ${status} server delay stops retries and preserves error details`, async () => {
		for (const header of [
			"3600",
			"9".repeat(400),
			new Date(Date.now() + 3_600_000).toUTCString(),
		]) {
			let calls = 0;
			const client = new PayGatewayClient({
				token: "jwt",
				baseUrl: "https://pay.example",
				retry: { maxDelayMs: 20 },
				fetch: (async () => {
					calls++;
					return new Response("provider failure", { status, headers: { "Retry-After": header } });
				}) as unknown as typeof globalThis.fetch,
			});
			const timer = spyOn(globalThis, "setTimeout");
			try {
				await expect(client.request("GET", "/read")).rejects.toMatchObject({
					status,
					rawBody: "provider failure",
					retryAfterMs: /^9+$/.test(header) ? Number.POSITIVE_INFINITY : expect.any(Number),
				});
				expect(calls).toBe(1);
				expect(timer).not.toHaveBeenCalled();
			} finally {
				timer.mockRestore();
			}
		}
	});
}

test("PayGateway: within-budget Retry-After uses the full server delay", async () => {
	let calls = 0;
	const client = new PayGatewayClient({
		token: "jwt",
		baseUrl: "https://pay.example",
		retry: { maxDelayMs: 1000 },
		fetch: (async () =>
			++calls === 1
				? new Response("busy", { status: 503, headers: { "Retry-After": "1" } })
				: Response.json({ Data: { ok: true } })) as unknown as typeof globalThis.fetch,
	});
	const original = globalThis.setTimeout;
	const timer = spyOn(globalThis, "setTimeout").mockImplementation(((
		...args: Parameters<typeof setTimeout>
	) => original(args[0], 0, ...args.slice(2))) as typeof setTimeout);
	try {
		expect(await client.request("GET", "/read")).toEqual({ ok: true });
		expect(timer.mock.calls[0]?.[1]).toBe(1000);
		expect(calls).toBe(2);
	} finally {
		timer.mockRestore();
	}
});

test("PayGateway: excluded 429 is not replayed", async () => {
	let calls = 0;
	const client = new PayGatewayClient({
		token: "jwt",
		baseUrl: "https://pay.example",
		retry: { retryableStatuses: new Set() },
		fetch: (async () => {
			calls++;
			return new Response("busy", { status: 429, headers: { "Retry-After": "0" } });
		}) as unknown as typeof globalThis.fetch,
	});
	await expect(client.request("GET", "/read")).rejects.toMatchObject({
		status: 429,
		retryAfterMs: 0,
	});
	expect(calls).toBe(1);
});

test("PayGateway: an over-budget header does not hide an unread mutation response", async () => {
	const client = new PayGatewayClient({
		token: "jwt",
		baseUrl: "https://pay.example",
		fetch: (async () =>
			new Response(
				new ReadableStream({
					start(controller) {
						controller.error(new Error("body lost"));
					},
				}),
				{ status: 503, headers: { "Retry-After": "3600" } },
			)) as unknown as typeof globalThis.fetch,
	});
	await expect(client.request("POST", "/unsigned-mutation", {})).rejects.toBeInstanceOf(
		TochkaUnknownOutcomeError,
	);
});

test("PayGateway: aborting an allowed server wait preserves the caller reason", async () => {
	const controller = new AbortController();
	const reason = new Error("cancel retry wait");
	const client = new PayGatewayClient({
		token: "jwt",
		baseUrl: "https://pay.example",
		retry: { maxDelayMs: 1000 },
		fetch: (async () => {
			controller.abort(reason);
			return new Response("busy", { status: 429, headers: { "Retry-After": "1" } });
		}) as unknown as typeof globalThis.fetch,
	});
	await expect(
		client.request("GET", "/read", undefined, { signal: controller.signal }),
	).rejects.toBe(reason);
});
