import type { PayGatewayClient } from "./client.js";
import { sitePath } from "./paths.js";

/**
 * Базовая структура ответа Pay Gateway по операциям. Response-тип оставлен
 * расширяемым через `[key: string]: unknown` намеренно — Точка не публикует
 * OpenAPI для pay-gateway, поля зависят от метода оплаты и статуса.
 */
export interface PayGatewayOperation {
	operationId?: string;
	paymentUid?: string;
	refundUid?: string;
	orderUid?: string;
	status?: {
		value:
			| "CREATED"
			| "PENDING"
			| "COMPLETED"
			| "AUTHORIZED"
			| "DECLINED"
			| "CANCELED"
			| (string & {});
		changedDateTime?: string;
		reasonSource?: string;
		reasonCode?: string;
		reasonMessage?: string;
	};
	[key: string]: unknown;
}

/**
 * Оплата по ранее выпущенному СБП-токену (рекуррентный платёж C2B).
 * Токен получают через {@link PayGatewaySbpFunctionalLinksModule}.
 *
 * @see docs/tochka/scraped/testing.md — `"paymentMethod": { "type": "SBP_TOKEN", "token": "..." }`
 */
export interface SbpTokenPaymentMethod {
	type: "SBP_TOKEN";
	/** Значение токена из результата привязки счёта. */
	token: string;
}

/** Метод оплаты. Недокументированные варианты — через `Record`-fallback. */
export type PayGatewayPaymentMethod = SbpTokenPaymentMethod | Record<string, unknown>;

/**
 * Параметры создания платежа. Поля строго типизированы — typo не пройдёт
 * компиляцию. Для недокументированных полей используйте `extra`.
 * @see docs/tochka/scraped/testing.md — поле `comment` для тестирования.
 */
export interface CreatePaymentRequest {
	/** Идентификатор сайта мерчанта; уходит в path, не в тело. */
	siteUid: string;
	amount: number | string;
	orderUid?: string;
	paymentMethod?: PayGatewayPaymentMethod;
	customer?: Record<string, unknown>;
	/** Произвольное назначение; в sandbox может содержать JSON-сценарии. */
	comment?: string;
	/** Escape-hatch для полей, ещё не добавленных в тип. */
	extra?: Record<string, unknown>;
}

export interface RefundRequest {
	amount: number | string;
	/** Идентификатор исходного платежа для возврата. */
	paymentUid?: string;
	orderUid?: string;
	agentRefundRequestId?: string;
	extra?: Record<string, unknown>;
}

function flatten<T extends { extra?: Record<string, unknown> }>(body: T): Record<string, unknown> {
	const { extra, ...rest } = body;
	return { ...rest, ...(extra ?? {}) };
}

/**
 * Платежи Pay Gateway. Пути следуют документированной структуре
 * `/uapi/pay/v1.0/sites/{siteUid}/...`; `siteUid` передаётся per-request, чтобы
 * один клиент обслуживал несколько сайтов.
 */
export class PayGatewayPaymentsModule {
	constructor(private readonly client: PayGatewayClient) {}

	/** Создать платёж. Подписывается автоматически (`Signature` заголовок). */
	create(body: CreatePaymentRequest): Promise<PayGatewayOperation> {
		const { siteUid, ...rest } = body;
		return this.client.request("POST", sitePath(siteUid, "/payments"), flatten(rest));
	}

	/** Получить информацию о платеже. */
	get(siteUid: string, operationId: string): Promise<PayGatewayOperation> {
		return this.client.request(
			"GET",
			sitePath(siteUid, `/payments/${encodeURIComponent(operationId)}`),
		);
	}

	/** Подтвердить платёж (двухэтапная оплата). */
	capture(
		siteUid: string,
		operationId: string,
		body: { amount?: number | string } = {},
	): Promise<PayGatewayOperation> {
		return this.client.request(
			"POST",
			sitePath(siteUid, `/payments/${encodeURIComponent(operationId)}/capture`),
			body,
		);
	}

	/** Возврат. `paymentUid` исходной операции передаётся в теле. */
	refund(siteUid: string, body: RefundRequest): Promise<PayGatewayOperation> {
		return this.client.request("POST", sitePath(siteUid, "/refunds"), flatten(body));
	}
}
