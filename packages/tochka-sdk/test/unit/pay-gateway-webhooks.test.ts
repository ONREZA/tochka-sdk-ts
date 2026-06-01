import { describe, expect, test } from "bun:test";
import { SignJWT, generateKeyPair } from "jose";
import { WebhookVerificationError, verifyPayGatewayWebhook } from "../../src/pay-gateway/index.js";

async function makeKeypair() {
	return generateKeyPair("RS256", { modulusLength: 2048 });
}

function sign(privateKey: CryptoKey, payload: Record<string, unknown>): Promise<string> {
	return new SignJWT(payload).setProtectedHeader({ alg: "RS256" }).sign(privateKey);
}

describe("verifyPayGatewayWebhook", () => {
	test("sbp-token-issued → дискриминированный event с token", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			event: "sbp-token-issued",
			payloadType: "sbp-tokenization-decision",
			payload: { qrcId: "q1", token: "TKN", status: "ACCEPTED" },
		});
		const event = await verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } });
		expect(event.event).toBe("sbp-token-issued");
		if (event.event === "sbp-token-issued") {
			expect(event.payload.token).toBe("TKN");
			expect(event.payload.qrcId).toBe("q1");
		}
	});

	test("sbp-token-declined → reasonCode доступен", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			event: "sbp-token-declined",
			payloadType: "sbp-tokenization-decision",
			payload: { qrcId: "q1", status: "REJECTED", reasonCode: "SUBSCRIPTION_REJECTED_BY_PAYER" },
		});
		const event = await verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } });
		expect(event.event).toBe("sbp-token-declined");
		if (event.event === "sbp-token-declined") {
			expect(event.payload.reasonCode).toBe("SUBSCRIPTION_REJECTED_BY_PAYER");
		}
	});

	test("payment-updated → status.value", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			event: "payment-updated",
			payloadType: "payment",
			payload: { paymentUid: "p1", status: { value: "COMPLETED" } },
		});
		const event = await verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } });
		expect(event.event).toBe("payment-updated");
		if (event.event === "payment-updated") {
			expect(event.payload.status?.value).toBe("COMPLETED");
		}
	});

	test("неизвестный event → reason=payload_shape", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, { event: "something-else", payload: {} });
		try {
			await verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } });
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(WebhookVerificationError);
			expect((err as WebhookVerificationError).reason).toBe("payload_shape");
		}
	});

	test("неверная подпись → reason=signature", async () => {
		const { privateKey } = await makeKeypair();
		const { publicKey: otherKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			event: "payment-updated",
			payloadType: "payment",
			payload: {},
		});
		try {
			await verifyPayGatewayWebhook(jwt, { keySource: { key: otherKey } });
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(WebhookVerificationError);
			expect((err as WebhookVerificationError).reason).toBe("signature");
		}
	});
});
