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
	type VerifyWebhookOptions,
	WebhookVerificationError,
	resolveKeyResolver,
	verifyWebhookJwt,
} from "./verify-core.js";

export {
	TOCHKA_WEBHOOK_JWKS_URL,
	createWebhookKeyResolver,
	getDefaultWebhookKeyResolver,
} from "./jwks.js";
export type { KeyResolver, WebhookKeySource } from "./jwks.js";
export {
	WebhookVerificationError,
	type VerifyWebhookOptions,
	type WebhookVerificationReason,
} from "./verify-core.js";

/** Общий дискриминатор событий вебхуков. */
export type WebhookType =
	| "incomingPayment"
	| "outgoingPayment"
	| "incomingSbpPayment"
	| "incomingSbpB2BPayment"
	| "acquiringInternetPayment";

const KNOWN_WEBHOOK_TYPES: ReadonlySet<WebhookType> = new Set<WebhookType>([
	"incomingPayment",
	"outgoingPayment",
	"incomingSbpPayment",
	"incomingSbpB2BPayment",
	"acquiringInternetPayment",
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
}

/** Дискриминированный union всех событий. */
export type TochkaWebhookEvent =
	| IncomingPaymentWebhook
	| OutgoingPaymentWebhook
	| IncomingSbpPaymentWebhook
	| IncomingSbpB2BPaymentWebhook
	| AcquiringInternetPaymentWebhook;

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
	return payload as unknown as TochkaWebhookEvent;
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
