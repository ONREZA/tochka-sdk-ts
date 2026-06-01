/**
 * Входящие вебхуки Pay Gateway (СБП). Отдельный контур от основного API Точки:
 * дискриминатор — пара `event` + `payloadType`, а не `webhookType`. Транспорт
 * тот же — JWT RS256 в теле POST (`Content-Type: text/plain`), тот же публичный
 * ключ Точки.
 *
 * Pay Gateway не публикует OpenAPI — вложенные поля `payload` типизированы по
 * документации (best-effort) и оставлены расширяемыми. Дискриминанты (`event`,
 * `payloadType`) и коды отказа взяты из docs.
 *
 * @see docs/tochka/scraped/webhooks.md
 * @see docs/tochka/scraped/api-references.md — reasonSource / reasonCode
 */

import {
	type VerifyWebhookOptions,
	WebhookVerificationError,
	verifyWebhookJwt,
} from "../webhooks/verify-core.js";

export { WebhookVerificationError } from "../webhooks/verify-core.js";
export type { VerifyWebhookOptions, WebhookVerificationReason } from "../webhooks/verify-core.js";

/** Источник причины отклонения операции. */
export type PayGatewayReasonSource =
	| "PROCESSING"
	| "ACQUIRER"
	| "PAY_SYSTEM"
	| "ISSUER"
	| "MPI"
	| "FRAUD"
	| (string & {});

/** Коды отклонения, применимые к СБП-операциям (`api-references.md`). */
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

/** Привязка счёта выполнена — выпущен СБП-токен. */
export interface SbpTokenIssuedWebhook {
	event: "sbp-token-issued";
	payloadType: "sbp-tokenization-decision";
	payload: {
		qrcId?: string;
		token?: string;
		status?: "ACCEPTED";
		[key: string]: unknown;
	};
}

/** Отказ в привязке счёта. */
export interface SbpTokenDeclinedWebhook {
	event: "sbp-token-declined";
	payloadType: "sbp-tokenization-decision";
	payload: {
		qrcId?: string;
		status?: "REJECTED";
		reasonCode?: PayGatewaySbpReasonCode;
		reasonSource?: PayGatewayReasonSource;
		[key: string]: unknown;
	};
}

/** Изменение статуса платежа (в т.ч. списания по СБП-токену). */
export interface PaymentUpdatedWebhook {
	event: "payment-updated";
	payloadType: "payment";
	payload: {
		paymentUid?: string;
		status?: {
			value?: "COMPLETED" | "DECLINED" | (string & {});
			reasonCode?: PayGatewaySbpReasonCode;
			reasonSource?: PayGatewayReasonSource;
			[key: string]: unknown;
		};
		[key: string]: unknown;
	};
}

/** Дискриминированный union вебхуков Pay Gateway. */
export type PayGatewayWebhookEvent =
	| SbpTokenIssuedWebhook
	| SbpTokenDeclinedWebhook
	| PaymentUpdatedWebhook;

export type PayGatewayWebhookEventName = PayGatewayWebhookEvent["event"];

const KNOWN_EVENTS: ReadonlySet<string> = new Set<PayGatewayWebhookEventName>([
	"sbp-token-issued",
	"sbp-token-declined",
	"payment-updated",
]);

/**
 * Проверить подпись и распарсить вебхук Pay Gateway.
 *
 * @param rawBody — строка JWT из тела POST-запроса (Content-Type: text/plain).
 * @returns типизированное событие, дискриминируемое по `event`.
 */
export async function verifyPayGatewayWebhook(
	rawBody: string,
	options: VerifyWebhookOptions = {},
): Promise<PayGatewayWebhookEvent> {
	const payload = await verifyWebhookJwt(rawBody, options);
	const event = payload.event;
	if (typeof event !== "string" || !KNOWN_EVENTS.has(event)) {
		throw new WebhookVerificationError(
			`Unknown or missing Pay Gateway webhook event: ${JSON.stringify(event)}`,
			"payload_shape",
		);
	}
	return payload as unknown as PayGatewayWebhookEvent;
}
