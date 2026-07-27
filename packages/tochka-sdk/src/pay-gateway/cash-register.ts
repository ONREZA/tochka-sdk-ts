import type { components } from "../_generated/pay-gateway.js";
import type { PayGatewayClient } from "./client.js";
import { sitePath, withQuery } from "./paths.js";
import type { SbpQrcIdType } from "./sbp.js";

type Schemas = components["schemas"];

export type CreateCashRegisterQrcRequest = Schemas["CreateCashRegisterQrCodeRequest"];
export type CashRegisterQrc = Schemas["QRCodeResponseDTO"];
export type ActivateCashRegisterQrcRequest = Schemas["ActivateCashRegisterQrCodeRequest"];
export type ActivateCashRegisterQrcResponse = Schemas["ActivateCashRegisterQrCodeResponse"];
export type CashRegisterQrcStatus = Schemas["GetCashRegisterQrCodeStatusResponse"];
export type CashRegisterQrcPayment = Schemas["PaymentResponseDTO"];

export class PayGatewayCashRegisterQrcModule {
	constructor(private readonly client: PayGatewayClient) {}

	create(siteUid: string, body: CreateCashRegisterQrcRequest): Promise<CashRegisterQrc> {
		return this.client.request("POST", sitePath(siteUid, "/sbp/qrc/cash-register-qrc"), {
			Data: body,
		});
	}

	activate(
		siteUid: string,
		qrcId: string,
		qrcIdType: SbpQrcIdType,
		body: ActivateCashRegisterQrcRequest,
	): Promise<ActivateCashRegisterQrcResponse> {
		return this.client.request(
			"POST",
			withQuery(
				sitePath(siteUid, `/sbp/qrc/cash-register-qrc/${encodeURIComponent(qrcId)}/activations`),
				{ qrcIdType },
			),
			{ Data: body },
		);
	}

	async deactivate(siteUid: string, qrcId: string, qrcIdType: SbpQrcIdType): Promise<void> {
		await this.client.request(
			"DELETE",
			withQuery(
				sitePath(
					siteUid,
					`/sbp/qrc/cash-register-qrc/${encodeURIComponent(qrcId)}/activations/current`,
				),
				{ qrcIdType },
			),
		);
	}

	getStatus(
		siteUid: string,
		qrcId: string,
		qrcIdType: SbpQrcIdType,
	): Promise<CashRegisterQrcStatus> {
		return this.client.request(
			"GET",
			withQuery(
				sitePath(siteUid, `/sbp/qrc/cash-register-qrc/${encodeURIComponent(qrcId)}/status`),
				{ qrcIdType },
			),
		);
	}

	getPayment(
		siteUid: string,
		qrcId: string,
		activationUid: string,
		qrcIdType: SbpQrcIdType,
	): Promise<CashRegisterQrcPayment> {
		return this.client.request(
			"GET",
			withQuery(
				sitePath(
					siteUid,
					`/sbp/qrc/cash-register-qrc/${encodeURIComponent(qrcId)}/activations/${encodeURIComponent(activationUid)}/payment`,
				),
				{ qrcIdType },
			),
		);
	}
}
