/**
 * Входящие вебхуки Pay Gateway. Тело запроса — JWT RS256; после проверки
 * подписи payload валидируется по дискриминаторам официальной OpenAPI.
 */

import type { components } from "../_generated/pay-gateway.js";
import {
	type VerifyWebhookOptions,
	verifyWebhookJwt,
	WebhookVerificationError,
} from "../webhooks/verify-core.js";

export type { VerifyWebhookOptions, WebhookVerificationReason } from "../webhooks/verify-core.js";
export { WebhookVerificationError } from "../webhooks/verify-core.js";

type Schemas = components["schemas"];

/** Источник причины отклонения операции. */
export type PayGatewayReasonSource =
	| "PROCESSING"
	| "ACQUIRER"
	| "PAY_SYSTEM"
	| "ISSUER"
	| "MPI"
	| "FRAUD"
	| (string & {});

/** Коды отклонения, применимые к СБП-операциям. */
export type PayGatewaySbpReasonCode =
	| "INTERNAL_ERROR"
	| "TECH_ERROR"
	| "LIMIT_EXCEEDED"
	| "OPERATION_NOT_SUPPORTED"
	| "PAYMENT_NOT_FOUND"
	| "NOT_PERMITTED"
	| "INTEGRATION_ERROR"
	| "VALIDATION_ERROR"
	| "TOO_MANY_REQUESTS"
	| "INSUFFICIENT_FUNDS"
	| "SUSPECTED_FRAUD"
	| "QR_CODE_NOT_FOUND"
	| "GATEWAY_TIMEOUT"
	| "UNEXPECTED_GATEWAY_RESPONSE"
	| "SUBSCRIPTION_REJECTED_BY_PAYER"
	| "SUBSCRIPTION_TOKEN_NOT_FOUND"
	| "PAYMENT_EXECUTION_REJECTED"
	| "REFUND_AMOUNT_EXCEEDS_PAYMENT_AMOUNT"
	| "PAYER_BANK_TIMEOUT"
	| "REFUND_ID_ALREADY_TAKEN"
	| (string & {});

type TokenizationNotification = Schemas["TokenizationDecisionNotification"];

export type SbpTokenIssuedWebhook = Omit<TokenizationNotification, "event" | "payload"> & {
	event: "sbp-token-issued";
	payload: Schemas["Accepted"];
};

export type SbpTokenDeclinedWebhook = Omit<TokenizationNotification, "event" | "payload"> & {
	event: "sbp-token-declined";
	payload: Schemas["Rejected"];
};

export type PaymentUpdatedWebhook = Schemas["PaymentUpdatedNotification"];
export type CaptureUpdatedWebhook = Schemas["CaptureUpdatedNotification"];
export type RefundUpdatedWebhook = Schemas["RefundUpdatedNotification"];

/** Дискриминированный union всех webhook-событий Pay Gateway. */
export type PayGatewayWebhookEvent =
	| SbpTokenIssuedWebhook
	| SbpTokenDeclinedWebhook
	| PaymentUpdatedWebhook
	| CaptureUpdatedWebhook
	| RefundUpdatedWebhook;

export type PayGatewayWebhookEventName = PayGatewayWebhookEvent["event"];

const PAYLOAD_TYPES: Readonly<Record<PayGatewayWebhookEventName, string>> = {
	"sbp-token-issued": "sbp-tokenization-decision",
	"sbp-token-declined": "sbp-tokenization-decision",
	"payment-updated": "payment",
	"capture-updated": "capture",
	"refund-updated": "refund",
};

const PAYMENT_METHOD_TYPES = [
	"CARD",
	"SBP_CUSTOMER_PRESENTED_QR",
	"SBP",
	"SBP_TOKEN",
	"SAVED_CARD",
	"SBP_CASH_REGISTER_QRC",
] as const;

/** Проверить подпись и распарсить webhook Pay Gateway. */
export async function verifyPayGatewayWebhook(
	rawBody: string,
	options: VerifyWebhookOptions = {},
): Promise<PayGatewayWebhookEvent> {
	const payload = await verifyWebhookJwt(rawBody, options);
	const event = payload.event;
	if (typeof event !== "string" || !Object.hasOwn(PAYLOAD_TYPES, event)) {
		throw shapeError(`Unknown or missing Pay Gateway webhook event: ${JSON.stringify(event)}`);
	}
	const eventName = event as PayGatewayWebhookEventName;
	if (payload.payloadType !== PAYLOAD_TYPES[eventName]) {
		throw shapeError(`Expected payloadType=${PAYLOAD_TYPES[eventName]} for event=${eventName}`);
	}
	assertEnum(payload, "version", ["1.0"]);
	assertString(payload, "siteUid");
	assertString(payload, "createdAt");
	assertRecord(payload.payload, "payload");

	if (eventName === "sbp-token-issued") {
		assertEnum(payload.payload, "status", ["ACCEPTED"]);
		assertStrings(payload.payload, ["qrcId", "metadata", "token", "memberId"]);
	} else if (eventName === "sbp-token-declined") {
		assertEnum(payload.payload, "status", ["REJECTED"]);
		assertStrings(payload.payload, ["qrcId", "metadata"]);
	} else if (eventName === "capture-updated") {
		assertString(payload, "paymentUid");
		assertOptionalString(payload, "invoiceUid");
		assertCapturePayload(payload.payload);
	} else if (eventName === "refund-updated") {
		assertString(payload, "paymentUid");
		assertOptionalString(payload, "invoiceUid");
		assertRefundPayload(payload.payload);
	} else {
		assertOptionalString(payload, "invoiceUid");
		assertPaymentPayload(payload.payload);
	}

	return payload as unknown as PayGatewayWebhookEvent;
}

function assertPaymentPayload(payload: Record<string, unknown>): void {
	assertStrings(payload, ["paymentUid", "createdDateTime", "metadata"]);
	assertMoney(payload.amount, "amount");
	assertMoney(payload.refundedAmount, "refundedAmount");
	assertChargebackSummary(payload.chargebackSummary);
	assertPaymentMethod(payload.paymentMethod);
	assertStatus(payload.status);
	assertBoolean(payload, "isTest");
}

function assertCapturePayload(payload: Record<string, unknown>): void {
	assertStrings(payload, ["captureUid", "createdDateTime"]);
	assertMoney(payload.amount, "amount");
	assertStatus(payload.status);
}

function assertRefundPayload(payload: Record<string, unknown>): void {
	assertStrings(payload, ["refundUid", "createdDateTime", "metadata"]);
	assertMoney(payload.amount, "amount");
	assertStatus(payload.status);
}

function assertMoney(value: unknown, name: string): void {
	assertRecord(value, name);
	assertStrings(value, ["amount", "currency"]);
}

function assertChargebackSummary(value: unknown): void {
	assertRecord(value, "chargebackSummary");
	assertMoney(value.chargedAmount, "chargebackSummary.chargedAmount");
	assertMoney(value.reversedAmount, "chargebackSummary.reversedAmount");
}

function assertPaymentMethod(value: unknown): void {
	assertRecord(value, "paymentMethod");
	assertEnum(value, "type", PAYMENT_METHOD_TYPES);
	switch (value.type) {
		case "CARD":
			assertEnum(value, "captureMode", ["AUTO", "MANUAL"]);
			assertString(value, "maskedPan");
			assertMoney(value.capturedAmount, "paymentMethod.capturedAmount");
			break;
		case "SAVED_CARD":
			assertEnum(value, "captureMode", ["AUTO", "MANUAL"]);
			assertString(value, "token");
			assertMoney(value.capturedAmount, "paymentMethod.capturedAmount");
			break;
		case "SBP_CASH_REGISTER_QRC":
			assertStrings(value, ["qrcId", "activationUid"]);
			break;
		default:
			assertString(value, "qrcId");
	}
}

function assertStatus(value: unknown): void {
	assertRecord(value, "status");
	assertEnum(value, "value", ["COMPLETED", "DECLINED", "WAITING"]);
	assertString(value, "changedDateTime");
	if (value.value === "DECLINED") {
		assertStrings(value, ["reasonCode", "reasonMessage", "reasonSource"]);
		assertOptionalString(value, "psErrorCode");
	}
}

function assertRecord(value: unknown, name: string): asserts value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw shapeError(`Expected ${name} to be an object`);
	}
}

function assertString(record: Record<string, unknown>, field: string): void {
	if (typeof record[field] !== "string") {
		throw shapeError(`Expected ${field} to be a string`);
	}
}

function assertStrings(record: Record<string, unknown>, fields: readonly string[]): void {
	for (const field of fields) assertString(record, field);
}

function assertOptionalString(record: Record<string, unknown>, field: string): void {
	if (record[field] !== undefined && typeof record[field] !== "string") {
		throw shapeError(`Expected ${field} to be a string`);
	}
}

function assertBoolean(record: Record<string, unknown>, field: string): void {
	if (typeof record[field] !== "boolean") {
		throw shapeError(`Expected ${field} to be a boolean`);
	}
}

function assertEnum(
	record: Record<string, unknown>,
	field: string,
	values: readonly string[],
): void {
	if (typeof record[field] !== "string" || !values.includes(record[field])) {
		throw shapeError(`Expected ${field} to be one of: ${values.join(", ")}`);
	}
}

function shapeError(message: string): WebhookVerificationError {
	return new WebhookVerificationError(message, "payload_shape");
}
