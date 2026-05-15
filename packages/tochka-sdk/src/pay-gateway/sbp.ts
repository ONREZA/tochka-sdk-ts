import type { PayGatewayClient } from "./client.js";

/**
 * Тип QR-кода Функциональной ссылки.
 * - `DYNAMIC` — сумма зафиксирована в самой ссылке (для разовой привязки + первой оплаты).
 * - `STATIC` — без суммы, плательщик сам вводит её в приложении банка.
 */
export type SbpFunctionalLinkQrcType = "DYNAMIC" | "STATIC";

export interface SbpAmount {
	currency: string;
	amount: string;
}

export interface SbpTokenizationServiceDetails {
	serviceName: string;
	serviceId: string;
}

export interface SbpFunctionalLinkPaymentToken {
	tokenizationPurpose: string;
	tokenizationServiceDetails: SbpTokenizationServiceDetails;
}

export interface CreateSbpFunctionalLinkRequest {
	qrcType: SbpFunctionalLinkQrcType;
	amount: SbpAmount;
	paymentPurpose?: string;
	paymentToken: SbpFunctionalLinkPaymentToken;
	ttl?: number;
}

export interface CreateSbpFunctionalLinkResponse {
	Data: {
		qrcId: string;
		payload: string;
		status: string;
		ttl?: number;
	};
}

export type SbpTokenizationStatus = "ACCEPTED" | "REJECTED";

export interface GetTokenizationResultResponse {
	Data: {
		status: SbpTokenizationStatus;
		token?: string;
		qrcId?: string;
		[key: string]: unknown;
	};
}

/**
 * Привязка счёта плательщика для рекуррентных платежей СБП (C2B).
 *
 * Контракт API «Приём платежей» Точки:
 * - `POST /sbp/qrc` — регистрация Функциональной ссылки СБП. Возвращает `qrcId`
 *   и `payload` (ссылка `qr.nspk.ru/...` для редиректа/QR-кода).
 * - `GET /sbp/qrc/{qrcId}/tokenization/result` — pull-получение результата
 *   токенизации (альтернатива вебхуку `sbp-token-issued`).
 *
 * После успешной токенизации полученный `token` используется в `payments.create`
 * с `paymentMethod: { type: "SBP_TOKEN", token: { value: <token> } }`.
 *
 * Доступно только для C2B (физлица). Привязка счёта ИП/юрлица вернёт
 * `SUBSCRIPTION_UNAVAILABLE`.
 *
 * @see https://developers.tochka.com/docs/pay-gateway/api/funkcionalnye-ssylki-sbp
 * @see https://developers.tochka.com/docs/pay-gateway/api/get-tokenization-result
 * @see https://developers.tochka.com/docs/pay-gateway/api/platyozhnye-tokeny
 */
export class PayGatewaySbpFunctionalLinksModule {
	constructor(private readonly client: PayGatewayClient) {}

	/**
	 * Регистрация Функциональной ссылки СБП.
	 *
	 * Заголовок `Signature` для этого endpoint **не требуется** — путь не входит
	 * в `DEFAULT_SIGNED_PATHS`. Достаточно `Authorization: Bearer`.
	 */
	create(body: CreateSbpFunctionalLinkRequest): Promise<CreateSbpFunctionalLinkResponse> {
		return this.client.request("POST", "/sbp/qrc", { Data: body });
	}

	/**
	 * Результат привязки счёта по ранее зарегистрированной ссылке. Полезно для
	 * pull-стратегии, если вебхук `sbp-token-issued` ещё не подписан.
	 */
	getTokenizationResult(qrcId: string): Promise<GetTokenizationResultResponse> {
		return this.client.request("GET", `/sbp/qrc/${encodeURIComponent(qrcId)}/tokenization/result`);
	}
}
