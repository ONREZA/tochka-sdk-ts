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
