import { describe, expect, test } from "bun:test";
import { generateKeyPair, SignJWT } from "jose";
import { verifyPayGatewayWebhook, WebhookVerificationError } from "../../src/pay-gateway/index.js";

async function makeKeypair() {
	return generateKeyPair("RS256", { modulusLength: 2048 });
}

function sign(privateKey: CryptoKey, payload: Record<string, unknown>): Promise<string> {
	return new SignJWT(payload).setProtectedHeader({ alg: "RS256" }).sign(privateKey);
}

const CREATED_AT = "2026-07-27T12:00:00Z";

function money(amount = "100.00") {
	return { amount, currency: "RUB" };
}

function completedStatus() {
	return { value: "COMPLETED", changedDateTime: CREATED_AT };
}

function paymentPayload() {
	return {
		paymentUid: "p1",
		createdDateTime: CREATED_AT,
		amount: money(),
		refundedAmount: money("0.00"),
		chargebackSummary: {
			chargedAmount: money("0.00"),
			reversedAmount: money("0.00"),
		},
		paymentMethod: { type: "SBP", qrcId: "q1" },
		status: completedStatus(),
		isTest: true,
		metadata: "{}",
	};
}

describe("verifyPayGatewayWebhook", () => {
	test("sbp-token-issued → дискриминированный event с token", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			version: "1.0",
			siteUid: "site-1",
			createdAt: "2026-07-27T12:00:00Z",
			event: "sbp-token-issued",
			payloadType: "sbp-tokenization-decision",
			payload: {
				qrcId: "q1",
				token: "TKN",
				status: "ACCEPTED",
				metadata: "{}",
				memberId: "100000000001",
			},
		});
		const event = await verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } });
		expect(event.event).toBe("sbp-token-issued");
		if (event.event === "sbp-token-issued") {
			expect(event.payload.token).toBe("TKN");
			expect(event.payload.qrcId).toBe("q1");
		}
	});

	test("sbp-token-declined → типизированный REJECTED payload", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			version: "1.0",
			siteUid: "site-1",
			createdAt: "2026-07-27T12:00:00Z",
			event: "sbp-token-declined",
			payloadType: "sbp-tokenization-decision",
			payload: { qrcId: "q1", status: "REJECTED", metadata: "{}" },
		});
		const event = await verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } });
		expect(event.event).toBe("sbp-token-declined");
		if (event.event === "sbp-token-declined") {
			expect(event.payload.status).toBe("REJECTED");
		}
	});

	test("payment-updated → status.value", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			version: "1.0",
			siteUid: "site-1",
			createdAt: CREATED_AT,
			event: "payment-updated",
			payloadType: "payment",
			payload: paymentPayload(),
		});
		const event = await verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } });
		expect(event.event).toBe("payment-updated");
		if (event.event === "payment-updated") {
			expect(event.payload.status?.value).toBe("COMPLETED");
		}
	});

	test("capture-updated → полный обязательный payload", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			version: "1.0",
			siteUid: "site-1",
			createdAt: CREATED_AT,
			event: "capture-updated",
			payloadType: "capture",
			paymentUid: "p1",
			payload: {
				captureUid: "c1",
				createdDateTime: CREATED_AT,
				amount: money(),
				status: completedStatus(),
			},
		});

		const event = await verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } });
		expect(event.event).toBe("capture-updated");
	});

	test("refund-updated → полный обязательный payload", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			version: "1.0",
			siteUid: "site-1",
			createdAt: CREATED_AT,
			event: "refund-updated",
			payloadType: "refund",
			paymentUid: "p1",
			payload: {
				refundUid: "r1",
				createdDateTime: CREATED_AT,
				amount: money(),
				status: completedStatus(),
				metadata: "{}",
			},
		});

		const event = await verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } });
		expect(event.event).toBe("refund-updated");
	});

	test("payment-updated проверяет весь обязательный payload", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const { amount: _amount, ...incompletePayload } = paymentPayload();
		const jwt = await sign(privateKey, {
			version: "1.0",
			siteUid: "site-1",
			createdAt: CREATED_AT,
			event: "payment-updated",
			payloadType: "payment",
			payload: incompletePayload,
		});

		await expect(
			verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } }),
		).rejects.toMatchObject({ reason: "payload_shape" });
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

	test("payloadType обязан соответствовать event", async () => {
		const { privateKey, publicKey } = await makeKeypair();
		const jwt = await sign(privateKey, {
			event: "payment-updated",
			payloadType: "sbp-tokenization-decision",
			payload: {},
		});
		try {
			await verifyPayGatewayWebhook(jwt, { keySource: { key: publicKey } });
			expect.unreachable();
		} catch (err) {
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
