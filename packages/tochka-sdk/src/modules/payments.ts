import type { components } from "../_generated/schema.js";
import { BaseModule } from "./base.js";

export type PaymentForSign = components["schemas"]["PaymentForSignRequestModel"];
export type PaymentForSignCreated = components["schemas"]["PaymentForSignResponseModel"];
export type PaymentForSignList = components["schemas"]["PaymentForSignListResponseModel"];
export type PaymentStatus = components["schemas"]["PaymentStatusResponseModel"];

export class PaymentsModule extends BaseModule {
	/** Создать платёж на подпись. Требует scope `CreatePaymentForSign`. */
	async createForSign(body: PaymentForSign): Promise<PaymentForSignCreated> {
		const { data } = await this.fetch.POST("/payment/v1.0/for-sign", {
			body: { Data: body },
		});
		return this.unwrap(data, "payments.createForSign");
	}

	/** Список платежей, ожидающих подписи. */
	async listForSign(customerCode?: string): Promise<PaymentForSignList> {
		const code = customerCode ?? this.requireCustomerCode("payments.listForSign");
		const { data } = await this.fetch.GET("/payment/v1.0/for-sign", {
			params: { query: { customerCode: code } },
		});
		return this.unwrap(data, "payments.listForSign");
	}

	/** Статус подписания платежа по `requestId`. */
	async getStatus(requestId: string): Promise<PaymentStatus> {
		const { data } = await this.fetch.GET("/payment/v1.0/status/{requestId}", {
			params: { path: { requestId } },
		});
		return this.unwrap(data, "payments.getStatus");
	}
}
