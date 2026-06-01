import { describe, expect, test } from "bun:test";
import { PayGatewayClient } from "../../src/pay-gateway/index.js";

async function pkcs8Pem(): Promise<string> {
	const kp = (await globalThis.crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	)) as CryptoKeyPair;
	const buf = await globalThis.crypto.subtle.exportKey("pkcs8", kp.privateKey);
	const bytes = new Uint8Array(buf);
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	const lines = btoa(bin).match(/.{1,64}/g) ?? [];
	return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

interface Captured {
	url?: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
}

function makeClient(captured: Captured, privateKey?: string) {
	const fetchImpl = (async (url: string, init: RequestInit) => {
		captured.url = url;
		captured.method = init.method;
		captured.headers = init.headers as Record<string, string>;
		captured.body = init.body as string | undefined;
		return new Response(JSON.stringify({ paymentUid: "p1" }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as unknown as typeof fetch;
	return new PayGatewayClient({
		token: "jwt-token",
		baseUrl: "https://pay.example",
		fetch: fetchImpl,
		...(privateKey !== undefined ? { privateKey } : {}),
	});
}

describe("PayGatewayPaymentsModule paths", () => {
	test("create → POST .../sites/{siteUid}/payments, тело плоское без siteUid, с Signature", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, await pkcs8Pem());
		await pg.payments.create({
			siteUid: "site-1",
			amount: "100.00",
			paymentMethod: { type: "SBP_TOKEN", token: "TKN123" },
		});
		expect(cap.method).toBe("POST");
		expect(cap.url).toBe("https://pay.example/uapi/pay/v1.0/sites/site-1/payments");
		const body = JSON.parse(cap.body ?? "{}");
		expect(body.siteUid).toBeUndefined();
		expect(body.amount).toBe("100.00");
		expect(body.paymentMethod).toEqual({ type: "SBP_TOKEN", token: "TKN123" });
		expect(cap.headers?.Signature).toBeDefined();
	});

	test("create без privateKey на подписанном пути → ошибка", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap);
		await expect(pg.payments.create({ siteUid: "s", amount: "1.00" })).rejects.toThrow(
			/requires signed body/,
		);
	});

	test("get → GET .../payments/{id}, без Signature (GET)", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, await pkcs8Pem());
		await pg.payments.get("site-1", "op-1");
		expect(cap.method).toBe("GET");
		expect(cap.url).toBe("https://pay.example/uapi/pay/v1.0/sites/site-1/payments/op-1");
		expect(cap.headers?.Signature).toBeUndefined();
	});

	test("capture → POST .../payments/{id}/capture с Signature", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, await pkcs8Pem());
		await pg.payments.capture("site-1", "op-1", { amount: "50.00" });
		expect(cap.url).toBe("https://pay.example/uapi/pay/v1.0/sites/site-1/payments/op-1/capture");
		expect(cap.headers?.Signature).toBeDefined();
	});

	test("refund → POST .../refunds, paymentUid в теле, с Signature", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, await pkcs8Pem());
		await pg.payments.refund("site-1", { amount: "50.00", paymentUid: "p-orig" });
		expect(cap.url).toBe("https://pay.example/uapi/pay/v1.0/sites/site-1/refunds");
		const body = JSON.parse(cap.body ?? "{}");
		expect(body.paymentUid).toBe("p-orig");
		expect(cap.headers?.Signature).toBeDefined();
	});

	test("siteUid URL-кодируется в пути", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, await pkcs8Pem());
		await pg.payments.get("site/with space", "op-1");
		expect(cap.url).toContain("/sites/site%2Fwith%20space/payments/op-1");
	});
});

describe("PayGatewayPaymentsModule CARD + 3DS", () => {
	test("create с CARD + tokenizationCredentials MIT — тело плоское", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, await pkcs8Pem());
		await pg.payments.create({
			siteUid: "site-1",
			amount: "100.00",
			paymentMethod: {
				type: "CARD",
				tokenizationCredentials: { type: "MIT_CREDENTIAL_ON_FILE" },
			},
		});
		const body = JSON.parse(cap.body ?? "{}");
		expect(body.Data).toBeUndefined();
		expect(body.paymentMethod).toEqual({
			type: "CARD",
			tokenizationCredentials: { type: "MIT_CREDENTIAL_ON_FILE" },
		});
		expect(cap.headers?.Signature).toBeDefined();
	});

	test("complete → POST .../payments/{paymentUid}/complete, плоское {type,paRes}, без Signature", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, await pkcs8Pem());
		await pg.payments.complete("site-1", "p-1", { paRes: "PARES_VALUE" });
		expect(cap.method).toBe("POST");
		expect(cap.url).toBe("https://pay.example/uapi/pay/v1.0/sites/site-1/payments/p-1/complete");
		const body = JSON.parse(cap.body ?? "{}");
		expect(body.Data).toBeUndefined();
		expect(body).toEqual({ type: "THREE_DS", paRes: "PARES_VALUE" });
		// complete не входит в DEFAULT_SIGNED_PATHS — подпись не требуется.
		expect(cap.headers?.Signature).toBeUndefined();
	});

	test("complete без privateKey работает (путь не подписан)", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap); // без privateKey
		await expect(pg.payments.complete("s", "p-1", { paRes: "X" })).resolves.toBeDefined();
	});

	test("ответ в конверте {Data,Links,Meta} разворачивается, requirements.THREE_DS доступен", async () => {
		const fetchImpl = (async () =>
			new Response(
				JSON.stringify({
					Data: {
						paymentUid: "p1",
						status: { value: "PENDING" },
						requirements: { type: "THREE_DS", paReq: "PAREQ", acsUrl: "https://acs.bank/3ds" },
					},
					Links: { self: "https://enter.tochka.com/uapi/pay" },
					Meta: { totalPages: 0 },
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)) as unknown as typeof fetch;
		const pg = new PayGatewayClient({
			token: "jwt",
			baseUrl: "https://pay.example",
			fetch: fetchImpl,
			privateKey: await pkcs8Pem(),
		});
		const op = await pg.payments.create({
			siteUid: "site-1",
			amount: "100.00",
			paymentMethod: { type: "CARD" },
		});
		// Поле берётся из Data, а не из корня конверта.
		expect(op.paymentUid).toBe("p1");
		expect(op.requirements?.type).toBe("THREE_DS");
		expect(op.requirements?.acsUrl).toBe("https://acs.bank/3ds");
		// Конверт не протекает наружу.
		expect((op as Record<string, unknown>).Data).toBeUndefined();
		expect((op as Record<string, unknown>).Links).toBeUndefined();
	});

	test("ответ без конверта Data пропускается как есть (толерантность)", async () => {
		const fetchImpl = (async () =>
			new Response(JSON.stringify({ paymentUid: "flat-1" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})) as unknown as typeof fetch;
		const pg = new PayGatewayClient({
			token: "jwt",
			baseUrl: "https://pay.example",
			fetch: fetchImpl,
		});
		const op = await pg.payments.get("site-1", "flat-1");
		expect(op.paymentUid).toBe("flat-1");
	});
});
