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
	assertString(payload, "version");
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
		assertStrings(payload.payload, ["captureUid", "createdDateTime"]);
	} else if (eventName === "refund-updated") {
		assertString(payload, "paymentUid");
		assertStrings(payload.payload, ["refundUid", "createdDateTime", "metadata"]);
	} else {
		assertStrings(payload.payload, ["paymentUid", "createdDateTime", "metadata"]);
	}

	return payload as unknown as PayGatewayWebhookEvent;
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
