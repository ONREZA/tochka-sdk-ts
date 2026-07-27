/**
 * Верификация и типобезопасная обработка вебхуков Точки.
 *
 * Контракт банка: тело вебхука = JWT RS256, Content-Type: text/plain.
 * Публичный ключ: {@link TOCHKA_WEBHOOK_JWKS_URL}.
 *
 * @see docs/tochka/scraped-tochka-api/opisanie-metodov-vebhuki.md
 * @see docs/tochka/scraped/webhooks.md
 */

import {
	resolveKeyResolver,
	type VerifyWebhookOptions,
	verifyWebhookJwt,
	WebhookVerificationError,
} from "./verify-core.js";

export type { KeyResolver, WebhookKeySource, WebhookVerificationKey } from "./jwks.js";
export {
	createWebhookKeyResolver,
	getDefaultWebhookKeyResolver,
	TOCHKA_WEBHOOK_JWKS_URL,
} from "./jwks.js";
export {
	type VerifyWebhookOptions,
	WebhookVerificationError,
	type WebhookVerificationReason,
} from "./verify-core.js";

/** Общий дискриминатор событий вебхуков. */
export type WebhookType =
	| "incomingPayment"
	| "outgoingPayment"
	| "incomingSbpPayment"
	| "incomingSbpB2BPayment"
	| "acquiringInternetPayment"
	| "customWebhook";

const KNOWN_WEBHOOK_TYPES: ReadonlySet<WebhookType> = new Set<WebhookType>([
	"incomingPayment",
	"outgoingPayment",
	"incomingSbpPayment",
	"incomingSbpB2BPayment",
	"acquiringInternetPayment",
	"customWebhook",
]);

interface PaymentSide {
	bankCode: string;
	bankName: string;
	bankCorrespondentAccount: string;
	account: string;
	name: string;
	amount: string;
	currency: string;
	inn: string;
	kpp?: string;
}

export interface IncomingPaymentWebhook {
	webhookType: "incomingPayment";
	SidePayer: PaymentSide;
	SideRecipient: PaymentSide;
	purpose: string;
	documentNumber: string;
	paymentId: string;
	date: string;
	customerCode: string;
}

export interface OutgoingPaymentWebhook extends Omit<IncomingPaymentWebhook, "webhookType"> {
	webhookType: "outgoingPayment";
}

export interface IncomingSbpPaymentWebhook {
	webhookType: "incomingSbpPayment";
	operationId: string;
	qrcId: string;
	amount: string;
	payerMobileNumber: string;
	payerName: string;
	brandName: string;
	merchantId: string;
	purpose: string;
	customerCode: string;
	refTransactionId?: string;
}

export interface IncomingSbpB2BPaymentWebhook {
	webhookType: "incomingSbpB2BPayment";
	qrcId: string;
	amount: string;
	purpose: string;
	customerCode: string;
}

export interface AcquiringInternetPaymentWebhook {
	webhookType: "acquiringInternetPayment";
	customerCode: string;
	amount: string;
	operationId: string;
	purpose: string;
	merchantId: string;
	status: "AUTHORIZED" | "APPROVED";
	paymentLinkId?: string;
	paymentType: "card" | "sbp" | "dolyame";
	consumerId?: string;
	transactionId?: string;
	qrcId?: string;
	payerName?: string;
	/** Маскированный номер карты для оплат подписки без графика. */
	maskedPan?: string;
	/** Платёжная система карты. */
	cardType?: string;
	/** Токен карты покупателя. */
	tokenCardId?: string;
}

/**
 * Пользовательский webhook. OpenAPI фиксирует только дискриминатор; набор
 * остальных полей определяется настройкой webhook на стороне Точки.
 */
export interface CustomWebhook {
	webhookType: "customWebhook";
	[key: string]: unknown;
}

/** Дискриминированный union всех событий. */
export type TochkaWebhookEvent =
	| IncomingPaymentWebhook
	| OutgoingPaymentWebhook
	| IncomingSbpPaymentWebhook
	| IncomingSbpB2BPaymentWebhook
	| AcquiringInternetPaymentWebhook
	| CustomWebhook;

/**
 * Распарсить и проверить подпись тела вебхука.
 *
 * @param rawBody — строка JWT из тела POST-запроса (Content-Type: text/plain).
 * @returns типизированное событие.
 */
export async function verifyWebhook(
	rawBody: string,
	options: VerifyWebhookOptions = {},
): Promise<TochkaWebhookEvent> {
	const payload = await verifyWebhookJwt(rawBody, options);
	return assertWebhookShape(payload);
}

function assertWebhookShape(payload: Record<string, unknown>): TochkaWebhookEvent {
	const type = payload.webhookType;
	if (typeof type !== "string" || !KNOWN_WEBHOOK_TYPES.has(type as WebhookType)) {
		throw new WebhookVerificationError(
			`Unknown or missing webhookType: ${JSON.stringify(type)}`,
			"payload_shape",
		);
	}
	if (type === "customWebhook") return payload as CustomWebhook;

	switch (type) {
		case "incomingPayment":
		case "outgoingPayment":
			assertPaymentSide(payload.SidePayer, "SidePayer");
			assertPaymentSide(payload.SideRecipient, "SideRecipient");
			assertRequiredStrings(payload, [
				"purpose",
				"documentNumber",
				"paymentId",
				"date",
				"customerCode",
			]);
			break;
		case "incomingSbpPayment":
			assertRequiredStrings(payload, [
				"operationId",
				"qrcId",
				"amount",
				"payerMobileNumber",
				"payerName",
				"brandName",
				"merchantId",
				"purpose",
				"customerCode",
			]);
			assertOptionalString(payload, "refTransactionId");
			break;
		case "incomingSbpB2BPayment":
			assertRequiredStrings(payload, ["qrcId", "amount", "purpose", "customerCode"]);
			break;
		case "acquiringInternetPayment":
			assertRequiredStrings(payload, [
				"customerCode",
				"amount",
				"operationId",
				"purpose",
				"merchantId",
			]);
			assertEnum(payload, "status", ["AUTHORIZED", "APPROVED"]);
			assertEnum(payload, "paymentType", ["card", "sbp", "dolyame"]);
			for (const field of [
				"paymentLinkId",
				"consumerId",
				"transactionId",
				"qrcId",
				"payerName",
				"maskedPan",
				"cardType",
				"tokenCardId",
			]) {
				assertOptionalString(payload, field);
			}
			break;
	}
	return payload as unknown as TochkaWebhookEvent;
}

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new WebhookVerificationError(`Expected ${path} to be an object`, "payload_shape");
	}
}

function assertRequiredStrings(payload: Record<string, unknown>, fields: readonly string[]): void {
	for (const field of fields) {
		if (typeof payload[field] !== "string") {
			throw new WebhookVerificationError(`Expected ${field} to be a string`, "payload_shape");
		}
	}
}

function assertOptionalString(payload: Record<string, unknown>, field: string): void {
	if (payload[field] !== undefined && typeof payload[field] !== "string") {
		throw new WebhookVerificationError(`Expected ${field} to be a string`, "payload_shape");
	}
}

function assertEnum(
	payload: Record<string, unknown>,
	field: string,
	values: readonly string[],
): void {
	if (typeof payload[field] !== "string" || !values.includes(payload[field])) {
		throw new WebhookVerificationError(
			`Expected ${field} to be one of: ${values.join(", ")}`,
			"payload_shape",
		);
	}
}

function assertPaymentSide(value: unknown, path: string): void {
	assertRecord(value, path);
	assertRequiredStrings(value, [
		"bankCode",
		"bankName",
		"bankCorrespondentAccount",
		"account",
		"name",
		"amount",
		"currency",
		"inn",
	]);
	assertOptionalString(value, "kpp");
}

/**
 * Построить резолвер один раз и переиспользовать — удобно в долгоживущих серверах,
 * чтобы не обращаться к `getDefaultWebhookKeyResolver` при каждом запросе.
 */
export function createWebhookVerifier(options: VerifyWebhookOptions = {}) {
	const resolver = resolveKeyResolver(options);
	const jwtOptions = options.jwtOptions;
	return (rawBody: string) =>
		verifyWebhook(
			rawBody,
			jwtOptions !== undefined ? { keyResolver: resolver, jwtOptions } : { keyResolver: resolver },
		);
}
