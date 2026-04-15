import type { PayGatewayClient } from "./client.js";

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
 * Параметры создания платежа. Поля строго типизированы — typo не пройдёт
 * компиляцию. Для недокументированных полей используйте `extra`.
 * @see docs/tochka/scraped/testing.md — поле `comment` для тестирования.
 */
export interface CreatePaymentRequest {
	siteUid: string;
	amount: number | string;
	orderUid?: string;
	paymentMethod?: Record<string, unknown>;
	customer?: Record<string, unknown>;
	/** Произвольное назначение; в sandbox может содержать JSON-сценарии. */
	comment?: string;
	/** Escape-hatch для полей, ещё не добавленных в тип. */
	extra?: Record<string, unknown>;
}

export interface RefundRequest {
	amount: number | string;
	orderUid?: string;
	agentRefundRequestId?: string;
	extra?: Record<string, unknown>;
}

function flatten<T extends { extra?: Record<string, unknown> }>(body: T): Record<string, unknown> {
	const { extra, ...rest } = body;
	return { ...rest, ...(extra ?? {}) };
}

export class PayGatewayPaymentsModule {
	constructor(private readonly client: PayGatewayClient) {}

	/** Создать платёж. Подписывается автоматически (`Signature` заголовок). */
	create(body: CreatePaymentRequest): Promise<PayGatewayOperation> {
		return this.client.request("POST", "/create-payment", flatten(body));
	}

	/** Получить информацию о платеже. */
	get(operationId: string): Promise<PayGatewayOperation> {
		return this.client.request("GET", `/payment/${encodeURIComponent(operationId)}`);
	}

	/** Подтвердить платёж (двухэтапная оплата). */
	capture(
		operationId: string,
		body: { amount?: number | string } = {},
	): Promise<PayGatewayOperation> {
		return this.client.request("POST", `/create-capture/${encodeURIComponent(operationId)}`, body);
	}

	/** Возврат. */
	refund(operationId: string, body: RefundRequest): Promise<PayGatewayOperation> {
		return this.client.request(
			"POST",
			`/create-refund/${encodeURIComponent(operationId)}`,
			flatten(body),
		);
	}
}
