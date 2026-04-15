/**
 * Верификация и типобезопасная обработка вебхуков Точки.
 *
 * Контракт банка: тело вебхука = JWT RS256, Content-Type: text/plain.
 * Публичный ключ: {@link TOCHKA_WEBHOOK_JWKS_URL}.
 *
 * @see docs/tochka/scraped-tochka-api/opisanie-metodov-vebhuki.md
 * @see docs/tochka/scraped/webhooks.md
 */

import { type JWTVerifyOptions, errors as joseErrors, jwtVerify } from "jose";
import {
	type KeyResolver,
	type WebhookKeySource,
	createWebhookKeyResolver,
	getDefaultWebhookKeyResolver,
} from "./jwks.js";

export {
	TOCHKA_WEBHOOK_JWKS_URL,
	createWebhookKeyResolver,
	getDefaultWebhookKeyResolver,
} from "./jwks.js";
export type { KeyResolver, WebhookKeySource } from "./jwks.js";

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

export interface VerifyWebhookOptions {
	/** Источник ключа. По умолчанию — публичный JWK Точки. */
	keySource?: WebhookKeySource;
	/** Заготовленный резолвер ключа (взаимоисключим с `keySource`). */
	keyResolver?: KeyResolver;
	/** Опции `jose.jwtVerify` — `issuer`, `audience`, `clockTolerance`. */
	jwtOptions?: JWTVerifyOptions;
}

/** Причина, по которой верификация не прошла. */
export type WebhookVerificationReason =
	| "signature"
	| "expired"
	| "not_yet_valid"
	| "algorithm"
	| "jwt_format"
	| "key_fetch"
	| "payload_shape"
	| "unknown";

export class WebhookVerificationError extends Error {
	override readonly name = "WebhookVerificationError";
	readonly reason: WebhookVerificationReason;
	constructor(message: string, reason: WebhookVerificationReason, options?: { cause?: unknown }) {
		super(message, options);
		this.reason = reason;
	}
}

function classifyJoseError(err: unknown): WebhookVerificationReason {
	if (err instanceof joseErrors.JWSSignatureVerificationFailed) return "signature";
	if (err instanceof joseErrors.JWTExpired) return "expired";
	if (err instanceof joseErrors.JWTClaimValidationFailed) return "expired";
	if (err instanceof joseErrors.JOSEAlgNotAllowed) return "algorithm";
	if (err instanceof joseErrors.JWSInvalid || err instanceof joseErrors.JWTInvalid)
		return "jwt_format";
	if (
		err instanceof joseErrors.JWKSNoMatchingKey ||
		err instanceof joseErrors.JWKSMultipleMatchingKeys
	)
		return "key_fetch";
	return "unknown";
}

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
	if (!rawBody || typeof rawBody !== "string") {
		throw new WebhookVerificationError("Empty webhook body", "jwt_format");
	}
	const resolver =
		options.keyResolver ??
		(options.keySource
			? createWebhookKeyResolver(options.keySource)
			: getDefaultWebhookKeyResolver());
	try {
		const { payload } = await jwtVerify(rawBody.trim(), resolver, {
			...(options.jwtOptions ?? {}),
			algorithms: ["RS256"],
		});
		return assertWebhookShape(payload as Record<string, unknown>);
	} catch (err) {
		if (err instanceof WebhookVerificationError) throw err;
		const reason = classifyJoseError(err);
		throw new WebhookVerificationError(
			`Webhook verification failed (${reason}): ${(err as Error).message}`,
			reason,
			{ cause: err },
		);
	}
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
	const resolver =
		options.keyResolver ??
		(options.keySource
			? createWebhookKeyResolver(options.keySource)
			: getDefaultWebhookKeyResolver());
	const jwtOptions = options.jwtOptions;
	return (rawBody: string) =>
		verifyWebhook(
			rawBody,
			jwtOptions !== undefined ? { keyResolver: resolver, jwtOptions } : { keyResolver: resolver },
		);
}
