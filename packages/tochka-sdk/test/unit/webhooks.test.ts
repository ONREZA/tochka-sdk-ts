import { describe, expect, test } from "bun:test";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { WebhookVerificationError, verifyWebhook } from "../../src/webhooks/index.js";

async function makeKeypair() {
	const { publicKey, privateKey } = await generateKeyPair("RS256", { modulusLength: 2048 });
	const jwk = await exportJWK(publicKey);
	return { publicKey, privateKey, jwk };
}

async function sign(privateKey: CryptoKey, payload: Record<string, unknown>): Promise<string> {
	return new SignJWT(payload).setProtectedHeader({ alg: "RS256" }).sign(privateKey);
}

describe("verifyWebhook", () => {
	test("валидный JWT возвращает типизированный event", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			webhookType: "incomingSbpPayment",
			operationId: "op-1",
			qrcId: "qr-1",
			amount: "100.00",
			payerMobileNumber: "+79999999999",
			payerName: "Ivan I.",
			brandName: "Test",
			merchantId: "MF1",
			purpose: "test",
			customerCode: "300123",
		});
		const event = await verifyWebhook(jwt, { keySource: { key: publicKey } });
		expect(event.webhookType).toBe("incomingSbpPayment");
		if (event.webhookType === "incomingSbpPayment") {
			expect(event.operationId).toBe("op-1");
			expect(event.amount).toBe("100.00");
		}
	});

	test("неверная подпись → reason=signature", async () => {
		const { privateKey } = await makeKeypair();
		const { publicKey: otherKey } = await makeKeypair();
		const jwt = await sign(privateKey, { webhookType: "incomingPayment" });
		try {
			await verifyWebhook(jwt, { keySource: { key: otherKey } });
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(WebhookVerificationError);
			expect((err as WebhookVerificationError).reason).toBe("signature");
		}
	});

	test("не RS256 (HS256) → reason=algorithm", async () => {
		const { publicKey } = await makeKeypair();
		const hmacKey = new TextEncoder().encode("hs256-secret-long-enough-for-jose");
		const jwt = await new SignJWT({ webhookType: "incomingPayment" })
			.setProtectedHeader({ alg: "HS256" })
			.sign(hmacKey);
		try {
			await verifyWebhook(jwt, { keySource: { key: publicKey } });
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(WebhookVerificationError);
			expect((err as WebhookVerificationError).reason).toBe("algorithm");
		}
	});

	test("пустое тело → reason=jwt_format", async () => {
		try {
			await verifyWebhook("", { keySource: { jwk: { kty: "RSA", n: "x", e: "AQAB" } } });
			expect.unreachable();
		} catch (err) {
			expect((err as WebhookVerificationError).reason).toBe("jwt_format");
		}
	});

	test("мусорный payload → reason=jwt_format или key_fetch", async () => {
		const { publicKey } = await makeKeypair();
		try {
			await verifyWebhook("not.a.jwt", { keySource: { key: publicKey } });
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(WebhookVerificationError);
		}
	});

	test("неизвестный webhookType → reason=payload_shape", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, { webhookType: "someFutureEvent", data: "x" });
		try {
			await verifyWebhook(jwt, { keySource: { key: publicKey } });
			expect.unreachable();
		} catch (err) {
			expect((err as WebhookVerificationError).reason).toBe("payload_shape");
		}
	});

	test("отсутствующий webhookType → reason=payload_shape", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, { amount: "100" });
		try {
			await verifyWebhook(jwt, { keySource: { key: publicKey } });
			expect.unreachable();
		} catch (err) {
			expect((err as WebhookVerificationError).reason).toBe("payload_shape");
		}
	});

	test("expired JWT → reason=expired", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await new SignJWT({ webhookType: "incomingPayment" })
			.setProtectedHeader({ alg: "RS256" })
			.setExpirationTime(Math.floor(Date.now() / 1000) - 10)
			.sign(privateKey);
		try {
			await verifyWebhook(jwt, { keySource: { key: publicKey } });
			expect.unreachable();
		} catch (err) {
			expect((err as WebhookVerificationError).reason).toBe("expired");
		}
	});

	test("JWK в keySource тоже работает", async () => {
		const { privateKey, jwk } = await makeKeypair();
		const jwt = await sign(privateKey, {
			webhookType: "incomingSbpB2BPayment",
			qrcId: "q",
			amount: "1",
			purpose: "p",
			customerCode: "c",
		});
		const event = await verifyWebhook(jwt, { keySource: { jwk } });
		expect(event.webhookType).toBe("incomingSbpB2BPayment");
	});

	test("issuer validation через jwtOptions", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await new SignJWT({ webhookType: "incomingPayment" })
			.setProtectedHeader({ alg: "RS256" })
			.setIssuer("https://wrong.issuer")
			.sign(privateKey);
		await expect(
			verifyWebhook(jwt, {
				keySource: { key: publicKey },
				jwtOptions: { issuer: "https://enter.tochka.com" },
			}),
		).rejects.toBeInstanceOf(WebhookVerificationError);
	});

	test("user не может weakening algorithm через jwtOptions", async () => {
		const { publicKey } = await makeKeypair();
		const hmacKey = new TextEncoder().encode("hs256-secret-for-attack-attempt");
		const jwt = await new SignJWT({ webhookType: "incomingPayment" })
			.setProtectedHeader({ alg: "HS256" })
			.sign(hmacKey);
		await expect(
			verifyWebhook(jwt, {
				keySource: { key: publicKey },
				jwtOptions: { algorithms: ["HS256", "RS256"] },
			}),
		).rejects.toBeInstanceOf(WebhookVerificationError);
	});
});
