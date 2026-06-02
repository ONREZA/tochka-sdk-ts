import type { PayGatewayClient } from "./client.js";
import { sitePath } from "./paths.js";

/**
 * Требование пройти 3-D Secure. Возвращается в `requirements` ответа
 * `payments.create`, если платёж требует аутентификации покупателя (все разовые
 * карточные платежи и платежи с привязкой карты `CREDENTIAL_CAPTURED`).
 *
 * После получения этого объекта мерчант формирует POST-редирект браузера на
 * `acsUrl` с параметрами `PaReq` (= `paReq`), `MD` и `TermUrl`, а по возврату
 * вызывает {@link PayGatewayPaymentsModule.complete} с полученным `PaRes`.
 *
 * @see docs/tochka/scraped/threeds-authentication.md
 */
export interface ThreeDsRequirement {
	type: "THREE_DS";
	/** Зашифрованный запрос аутентификации (передаётся на `acsUrl` как `PaReq`). */
	paReq: string;
	/** URL ACS-сервера банка-эмитента для редиректа покупателя. */
	acsUrl: string;
	[key: string]: unknown;
}

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
	/**
	 * Присутствует, когда платёж требует дополнительного шага. Сейчас известен
	 * один тип — `THREE_DS` (см. {@link ThreeDsRequirement}).
	 */
	requirements?: ThreeDsRequirement;
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

/**
 * Сценарий работы с реквизитами карты (card-on-file).
 *
 * - `CREDENTIAL_CAPTURED` — привязка карты в рамках платежа; проходит 3DS.
 * - `CIT_CREDENTIAL_ON_FILE` — оплата сохранённой картой по инициативе клиента
 *   (Customer-Initiated); без 3DS.
 * - `MIT_CREDENTIAL_ON_FILE` — оплата сохранённой картой по инициативе мерчанта
 *   (Merchant-Initiated): рекуррент или рассрочка; без 3DS.
 *
 * @see docs/tochka/scraped/threeds-authentication.md
 */
export type TokenizationCredentialsType =
	| "CREDENTIAL_CAPTURED"
	| "CIT_CREDENTIAL_ON_FILE"
	| "MIT_CREDENTIAL_ON_FILE";

export interface TokenizationCredentials {
	type: TokenizationCredentialsType;
	/**
	 * Режим списания для `MIT_CREDENTIAL_ON_FILE` (`RECURRING` | `INSTALLMENT`).
	 * Точное имя поля не опубликовано в OpenAPI — оставлено расширяемым.
	 */
	[key: string]: unknown;
}

/**
 * Оплата банковской картой. Точные имена полей реквизитов (PAN/срок/CVC/держатель)
 * выдаются при онбординге и не опубликованы в OpenAPI — оставлены расширяемыми.
 * `tokenizationCredentials` управляет привязкой карты и списаниями card-on-file.
 */
export interface CardPaymentMethod {
	type: "CARD";
	tokenizationCredentials?: TokenizationCredentials;
	[key: string]: unknown;
}

/** Метод оплаты. Недокументированные варианты — через `Record`-fallback. */
export type PayGatewayPaymentMethod =
	| SbpTokenPaymentMethod
	| CardPaymentMethod
	| Record<string, unknown>;

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

export interface CompletePaymentRequest {
	/** Результат аутентификации покупателя (`PaRes` из редиректа на `TermUrl`). */
	paRes: string;
	/** Тип завершаемого требования. По умолчанию `THREE_DS`. */
	type?: "THREE_DS" | (string & {});
	/** Escape-hatch для полей, ещё не добавленных в тип. */
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

	/**
	 * Завершить 3-D Secure аутентификацию по платежу, передав полученный `PaRes`.
	 * Вызывается после того, как `create` вернул {@link ThreeDsRequirement}, а
	 * покупатель прошёл проверку на `acsUrl` и вернулся на `TermUrl`.
	 *
	 * Подпись `Signature` **не требуется** — документированный список подписанных
	 * путей ограничен `payments` / `capture` / `refunds`
	 * (`docs/tochka/scraped/request-signature-and-authorization.md`).
	 *
	 * @remarks Точный путь не опубликован в OpenAPI (pay-gateway его не имеет).
	 *   `/payments/{paymentUid}/complete` выведен из паттерна `capture`
	 *   (`.../payments/{id}/capture`) — проверьте на онбординг-сэндбоксе. При
	 *   расхождении переопределите через низкоуровневый `client.request`.
	 */
	complete(
		siteUid: string,
		paymentUid: string,
		body: CompletePaymentRequest,
	): Promise<PayGatewayOperation> {
		const { type = "THREE_DS", paRes, extra } = body;
		return this.client.request(
			"POST",
			sitePath(siteUid, `/payments/${encodeURIComponent(paymentUid)}/complete`),
			{ type, paRes, ...(extra ?? {}) },
		);
	}

	/** Возврат. `paymentUid` исходной операции передаётся в теле. */
	refund(siteUid: string, body: RefundRequest): Promise<PayGatewayOperation> {
		return this.client.request("POST", sitePath(siteUid, "/refunds"), flatten(body));
	}
}
