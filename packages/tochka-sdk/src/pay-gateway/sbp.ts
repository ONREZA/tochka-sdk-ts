import type { PayGatewayClient } from "./client.js";
import { sitePath } from "./paths.js";

/**
 * Тип QR-кода Функциональной ссылки.
 * - `DYNAMIC` — сумма зафиксирована в ссылке (разовая привязка + первая оплата).
 * - `STATIC` — без суммы, плательщик вводит её сам в приложении банка.
 * - `TOKEN` — привязка счёта без оплаты (выпуск токена для рекуррентов).
 *
 * @see docs/tochka/scraped/testing.md — `QRCodeDynamic` / `QRCodeStatic` / `QRCodeToken`
 */
export type SbpFunctionalLinkQrcType = "DYNAMIC" | "STATIC" | "TOKEN";

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
	/** Опционально: документированные примеры шлют `paymentToken` и без него. */
	tokenizationServiceDetails?: SbpTokenizationServiceDetails;
}

export interface CreateSbpFunctionalLinkRequest {
	/** Идентификатор сайта мерчанта; уходит в path, не в тело. */
	siteUid: string;
	qrcType: SbpFunctionalLinkQrcType;
	/** Не требуется для `STATIC` (плательщик вводит сумму сам) и `TOKEN`. */
	amount?: SbpAmount;
	paymentPurpose?: string;
	/** Заполняется для привязки счёта (`TOKEN` и «оплата с привязкой»). */
	paymentToken?: SbpFunctionalLinkPaymentToken;
	ttl?: number;
	/** Escape-hatch для полей, ещё не добавленных в тип. */
	extra?: Record<string, unknown>;
}

/**
 * Ответ на регистрацию Функциональной ссылки. Поля приходят внутри конверта
 * `{ Data, Links, Meta }` и разворачиваются клиентом (см. `PayGatewayClient`).
 */
export interface CreateSbpFunctionalLinkResponse {
	qrcId?: string;
	/** Ссылка `qr.nspk.ru/...` для QR-кода или редиректа в приложение банка. */
	payload?: string;
	status?: string;
	ttl?: number;
	[key: string]: unknown;
}

export type SbpTokenizationStatus = "ACCEPTED" | "REJECTED";

export interface SbpTokenizationResult {
	status?: SbpTokenizationStatus | (string & {});
	token?: string;
	qrcId?: string;
	[key: string]: unknown;
}

/**
 * Привязка счёта плательщика для рекуррентных платежей СБП (C2B).
 *
 * - `POST /sbp/qrc` — регистрация Функциональной ссылки. Возвращает `qrcId` и
 *   `payload` (`qr.nspk.ru/...`). Заголовок `Signature` **не требуется**.
 * - `GET /sbp/qrc/{qrcId}/tokenization/result` — pull-получение результата
 *   токенизации (альтернатива вебхуку `sbp-token-issued`).
 *
 * После успешной привязки токен используется в `payments.create` с
 * `paymentMethod: { type: "SBP_TOKEN", token }`.
 *
 * @see https://developers.tochka.com/docs/pay-gateway/api/funkcionalnye-ssylki-sbp
 * @see https://developers.tochka.com/docs/pay-gateway/api/get-tokenization-result
 */
export class PayGatewaySbpFunctionalLinksModule {
	constructor(private readonly client: PayGatewayClient) {}

	/** Регистрация Функциональной ссылки СБП. Возвращает `qrcId` и `payload`. */
	create(body: CreateSbpFunctionalLinkRequest): Promise<CreateSbpFunctionalLinkResponse> {
		const { siteUid, extra, ...rest } = body;
		return this.client.request("POST", sitePath(siteUid, "/sbp/qrc"), {
			...rest,
			...(extra ?? {}),
		});
	}

	/** Результат привязки счёта по ранее зарегистрированной ссылке. */
	getTokenizationResult(siteUid: string, qrcId: string): Promise<SbpTokenizationResult> {
		return this.client.request(
			"GET",
			sitePath(siteUid, `/sbp/qrc/${encodeURIComponent(qrcId)}/tokenization/result`),
		);
	}
}
