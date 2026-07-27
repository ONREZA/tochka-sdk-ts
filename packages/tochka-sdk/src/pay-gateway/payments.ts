import type { components } from "../_generated/pay-gateway.js";
import type { PayGatewayClient } from "./client.js";
import { sitePath } from "./paths.js";

type Schemas = components["schemas"];

export type PayGatewayAmount = Schemas["PaymentAmount"];
export type ThreeDsRequirement = Schemas["ThreeDSRequirements"];
export type TokenizationCredentials =
	| Schemas["CitCredentialOnFile"]
	| Schemas["CredentialCaptured"]
	| Schemas["MitCredentialOnFile"];
export type TokenizationCredentialsType = TokenizationCredentials["type"];
export type CardPaymentMethod = Schemas["CardPaymentMethod"];
export type SavedCardPaymentMethod = Schemas["SavedCardPaymentMethod"];
export type SbpCustomerPresentedQrPaymentMethod = Schemas["SBPCustomerPresentedQRPaymentMethod"];
export type SbpTokenPaymentMethod = Schemas["SbpGatewayTokenPaymentMethod"];
export type SbpNspkTokenPaymentMethod = Schemas["SbpNspkTokenPaymentMethod"];
export type PayGatewayPaymentMethod = Schemas["CreatePaymentRequestDTO"]["paymentMethod"];

export type PayGatewayOperation = Schemas["PaymentResponseDTO"];
export type CapturePaymentRequest = Schemas["CaptureRequestDTO"];
export type CapturePaymentResponse = Schemas["CaptureResponseDTO"];
export type CapturePaymentList = CapturePaymentResponse[];
export type RefundRequest = Schemas["RefundRequestDTO"];
export type RefundResponse = Schemas["RefundResponseDTO"];
export type RefundList = RefundResponse[];

export type CreatePaymentRequest = Schemas["CreatePaymentRequestDTO"] & {
	/** Идентификатор сайта мерчанта; уходит в path, не в тело. */
	siteUid: string;
	/** Escape-hatch для новых полей до следующей синхронизации OpenAPI. */
	extra?: Record<string, unknown>;
};

export type CompletePaymentRequest = Omit<Schemas["ThreeDSCompleteRequestDTO"], "type"> & {
	type?: "THREE_DS";
	/** Escape-hatch для новых полей до следующей синхронизации OpenAPI. */
	extra?: Record<string, unknown>;
};

function withExtra<T extends { extra?: Record<string, unknown> }>(
	body: T,
): Omit<T, "extra"> & Record<string, unknown> {
	const { extra, ...rest } = body;
	return { ...rest, ...(extra ?? {}) };
}

/**
 * Платежи Pay Gateway. Пути и тела соответствуют официальной Pay Gateway
 * OpenAPI: JSON-запросы оборачиваются в `{ Data: ... }`.
 */
export class PayGatewayPaymentsModule {
	constructor(private readonly client: PayGatewayClient) {}

	/** Создать платёж. Подписывается автоматически (`Signature` заголовок). */
	create(body: CreatePaymentRequest): Promise<PayGatewayOperation> {
		const { siteUid, ...request } = body;
		return this.client.request("POST", sitePath(siteUid, "/payments"), {
			Data: withExtra(request),
		});
	}

	/** Получить информацию о платеже. */
	get(siteUid: string, paymentUid: string): Promise<PayGatewayOperation> {
		return this.client.request(
			"GET",
			sitePath(siteUid, `/payments/${encodeURIComponent(paymentUid)}`),
		);
	}

	/** Подтвердить платёж после холдирования средств. */
	capture(
		siteUid: string,
		paymentUid: string,
		body: CapturePaymentRequest,
	): Promise<CapturePaymentResponse> {
		return this.client.request(
			"POST",
			sitePath(siteUid, `/payments/${encodeURIComponent(paymentUid)}/captures`),
			{ Data: body },
		);
	}

	/** Получить все попытки подтверждения платежа. */
	listCaptures(siteUid: string, paymentUid: string): Promise<CapturePaymentList> {
		return this.client.request(
			"GET",
			sitePath(siteUid, `/payments/${encodeURIComponent(paymentUid)}/captures`),
		);
	}

	/** Получить конкретную попытку подтверждения. */
	getCapture(
		siteUid: string,
		paymentUid: string,
		captureUid: string,
	): Promise<CapturePaymentResponse> {
		return this.client.request(
			"GET",
			sitePath(
				siteUid,
				`/payments/${encodeURIComponent(paymentUid)}/captures/${encodeURIComponent(captureUid)}`,
			),
		);
	}

	/** Завершить 3-D Secure аутентификацию по платежу. */
	complete(
		siteUid: string,
		paymentUid: string,
		body: CompletePaymentRequest,
	): Promise<PayGatewayOperation> {
		const { type = "THREE_DS", ...rest } = body;
		return this.client.request(
			"POST",
			sitePath(siteUid, `/payments/${encodeURIComponent(paymentUid)}/complete`),
			{ Data: withExtra({ type, ...rest }) },
		);
	}

	/** Создать полный или частичный возврат по платежу. */
	refund(siteUid: string, paymentUid: string, body: RefundRequest): Promise<RefundResponse> {
		return this.client.request(
			"POST",
			sitePath(siteUid, `/payments/${encodeURIComponent(paymentUid)}/refunds`),
			{ Data: body },
		);
	}

	/** Получить все возвраты по платежу. */
	listRefunds(siteUid: string, paymentUid: string): Promise<RefundList> {
		return this.client.request(
			"GET",
			sitePath(siteUid, `/payments/${encodeURIComponent(paymentUid)}/refunds`),
		);
	}

	/** Получить конкретный возврат. */
	getRefund(siteUid: string, paymentUid: string, refundUid: string): Promise<RefundResponse> {
		return this.client.request(
			"GET",
			sitePath(
				siteUid,
				`/payments/${encodeURIComponent(paymentUid)}/refunds/${encodeURIComponent(refundUid)}`,
			),
		);
	}
}
