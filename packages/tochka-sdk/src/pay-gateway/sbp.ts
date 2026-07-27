import type { components } from "../_generated/pay-gateway.js";
import type { PayGatewayClient } from "./client.js";
import { sitePath, withQuery } from "./paths.js";

type Schemas = components["schemas"];

export type SbpAmount = Schemas["PaymentAmount"];
export type SbpFunctionalLinkQrcType =
	Schemas["WrappedRequestDTOCreateQRCodeRequestDTO"]["Data"]["qrcType"];
export type SbpTokenizationServiceDetails = Schemas["TokenizationServiceDetailsDTO"];
export type SbpFunctionalLinkPaymentToken = Schemas["QRCodeTokenCreationParamsDTO"];
export type SbpQrcIdType = "NSPK" | "MERCHANT";

export type CreateSbpFunctionalLinkRequest = (
	| Schemas["QRCodeDynamic"]
	| Schemas["QRCodeStatic"]
	| Schemas["QRCodeToken"]
) & {
	/** Идентификатор сайта мерчанта; уходит в path, не в тело. */
	siteUid: string;
	/** Escape-hatch для новых полей до следующей синхронизации OpenAPI. */
	extra?: Record<string, unknown>;
};

export type CreateSbpFunctionalLinkResponse = Schemas["QRCodeResponseDTO"];
export type SbpFunctionalLinkPayments = Schemas["PaymentResponseDTO"][];
export type SbpTokenizationResult = Schemas["Accepted"] | Schemas["Rejected"];
export type SbpTokenizationStatus = SbpTokenizationResult["status"];

/**
 * Функциональные ссылки СБП. Тела соответствуют официальному конверту
 * `{ Data: ... }`; `qrcIdType` обязателен для запросов конкретной ссылки.
 */
export class PayGatewaySbpFunctionalLinksModule {
	constructor(private readonly client: PayGatewayClient) {}

	/** Регистрация Функциональной ссылки СБП. */
	create(body: CreateSbpFunctionalLinkRequest): Promise<CreateSbpFunctionalLinkResponse> {
		const { siteUid, extra, ...request } = body;
		return this.client.request("POST", sitePath(siteUid, "/sbp/qrc"), {
			Data: { ...request, ...(extra ?? {}) },
		});
	}

	/** Получить содержимое ранее зарегистрированной Функциональной ссылки. */
	get(
		siteUid: string,
		qrcId: string,
		options: {
			qrcIdType: SbpQrcIdType;
			mediaType?: "image/png" | "image/svg+xml";
			width?: number;
			height?: number;
		},
	): Promise<CreateSbpFunctionalLinkResponse> {
		return this.client.request(
			"GET",
			withQuery(sitePath(siteUid, `/sbp/qrc/${encodeURIComponent(qrcId)}`), options),
		);
	}

	/** Получить платежи по Функциональной ссылке. */
	listPayments(
		siteUid: string,
		qrcId: string,
		options: { qrcIdType: SbpQrcIdType; page?: number; perPage?: number },
	): Promise<SbpFunctionalLinkPayments> {
		return this.client.request(
			"GET",
			withQuery(sitePath(siteUid, `/sbp/qrc/${encodeURIComponent(qrcId)}/payments`), options),
		);
	}

	/** Результат привязки счёта по ранее зарегистрированной ссылке. */
	getTokenizationResult(
		siteUid: string,
		qrcId: string,
		qrcIdType: SbpQrcIdType,
	): Promise<SbpTokenizationResult> {
		return this.client.request(
			"GET",
			withQuery(sitePath(siteUid, `/sbp/qrc/${encodeURIComponent(qrcId)}/tokenization/result`), {
				qrcIdType,
			}),
		);
	}
}
