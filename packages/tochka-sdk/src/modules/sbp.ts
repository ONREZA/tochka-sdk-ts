import type { components } from "../_generated/schema.js";
import type { TochkaFetchClient } from "../core/http.js";
import { BaseModule } from "./base.js";

type SbpAccountList =
	components["schemas"]["application__sbp__models__response_models__sbp__AccountListResponseModel"]["Data"];

export type RegisterSbpLegalEntity = components["schemas"]["CustomerCodeAndBankCode"];
export type LegalEntityStatus = components["schemas"]["Status"];
export type LegalEntityInfo = components["schemas"]["LegalEntityResponseModel"]["Data"];
export type RegisteredLegalEntity =
	components["schemas"]["RegisterLegalEntityResponseModel"]["Data"];

export type RegisterMerchantBody = components["schemas"]["RegisterMerchant"];
export type MerchantId = components["schemas"]["MerchantIdResponseModel"]["Data"];
export type Merchant = components["schemas"]["MerchantResponseModel"]["Data"];
export type MerchantList = components["schemas"]["MerchantListResponseModel"]["Data"];

export type RegisterQrCodeBody = components["schemas"]["RegisterQRCode"];
export type QrCode = components["schemas"]["QRCodeResponseModel"]["Data"];
export type QrCodeRegistered = components["schemas"]["QRCodeModelResponseModel"]["Data"];
export type QrCodeList = components["schemas"]["QRCodeListResponseModel"]["Data"];
export type QrCodesPaymentStatus =
	components["schemas"]["QRCodePaymentStatusListResponseModel"]["Data"];

export type RegisterCashboxQrCodeRequest =
	components["schemas"]["RegisterCashboxQrCodeRequestModel"];
export type RegisteredCashboxQrCode =
	components["schemas"]["RegisterCashboxQrCodeResponseDataModel"]["Data"];
export type GetCashboxQrCodeRequest = components["schemas"]["GetCashboxQRCodeRequestModel"];
export type CashboxQrCode = components["schemas"]["GetCashboxQrCodeResponseDataModel"]["Data"];
export type CashboxQrCodeList =
	components["schemas"]["GetCashboxQRCodeListResponseDataModel"]["Data"];
export type ActivateCashboxQrCodeRequest =
	components["schemas"]["ActivateCashboxQrCodeRequestModel"];
export type ChangeCashboxAccountRequest =
	components["schemas"]["ChangeCashboxQRCodeAccountRequestModel"];

export type RegisterB2BQrCodeBody = components["schemas"]["RegisterB2BQRCode"];
export type B2BQrCode = components["schemas"]["B2BQrCodeResponseModel"]["Data"];
export type B2BQrCodeRegistered = components["schemas"]["B2BQRCodeModelResponseModel"]["Data"];

export type SbpRefundBody = components["schemas"]["SBPRefund"];
export type SbpRefundRequested = components["schemas"]["SBPRefundRequestResponseModel"]["Data"];
export type SbpRefundStatus = components["schemas"]["SBPRefundStatusModel"]["Data"];

export type SbpCustomerInfo = components["schemas"]["GetCustomerInfoResponseModelV3"]["Data"];
export type SbpPayments = components["schemas"]["SBPPaymentsResponse"]["Data"];

/** Работа с ЮЛ в сервисе СБП. */
export class SbpLegalEntityModule extends BaseModule {
	/** Зарегистрировать клиента как ЮЛ в СБП. */
	async register(body: RegisterSbpLegalEntity): Promise<RegisteredLegalEntity> {
		const { data } = await this.fetch.POST("/sbp/v1.0/register-sbp-legal-entity", {
			body: { Data: body },
		});
		return this.unwrap(data, "sbp.legalEntity.register");
	}

	async get(legalId: string): Promise<LegalEntityInfo> {
		const { data } = await this.fetch.GET("/sbp/v1.0/legal-entity/{legalId}", {
			params: { path: { legalId } },
		});
		return this.unwrap(data, "sbp.legalEntity.get");
	}

	/** Изменить статус ЮЛ. */
	async setStatus(legalId: string, status: LegalEntityStatus): Promise<boolean> {
		const { data } = await this.fetch.POST("/sbp/v1.0/legal-entity/{legalId}", {
			params: { path: { legalId } },
			body: { Data: status },
		});
		return this.unwrapBoolean(data, "sbp.legalEntity.setStatus");
	}

	/** Список счетов ЮЛ, зарегистрированных в СБП. */
	async listAccounts(legalId: string): Promise<SbpAccountList> {
		const { data } = await this.fetch.GET("/sbp/v1.0/account/{legalId}", {
			params: { path: { legalId } },
		});
		return this.unwrap(data, "sbp.legalEntity.listAccounts");
	}
}

/** ТСП — торгово-сервисные точки в СБП. */
export class SbpMerchantsModule extends BaseModule {
	async register(legalId: string, body: RegisterMerchantBody): Promise<MerchantId> {
		const { data } = await this.fetch.POST("/sbp/v1.0/merchant/legal-entity/{legalId}", {
			params: { path: { legalId } },
			body: { Data: body },
		});
		return this.unwrap(data, "sbp.merchants.register");
	}

	async list(legalId: string): Promise<MerchantList> {
		const { data } = await this.fetch.GET("/sbp/v1.0/merchant/legal-entity/{legalId}", {
			params: { path: { legalId } },
		});
		return this.unwrap(data, "sbp.merchants.list");
	}

	async get(merchantId: string): Promise<Merchant> {
		const { data } = await this.fetch.GET("/sbp/v1.0/merchant/{merchantId}", {
			params: { path: { merchantId } },
		});
		return this.unwrap(data, "sbp.merchants.get");
	}

	async setStatus(merchantId: string, status: LegalEntityStatus): Promise<boolean> {
		const { data } = await this.fetch.PUT("/sbp/v1.0/merchant/{merchantId}", {
			params: { path: { merchantId } },
			body: { Data: status },
		});
		return this.unwrapBoolean(data, "sbp.merchants.setStatus");
	}
}

/** Функциональные QR-коды СБП (статичные и динамические). */
export class SbpQrCodesModule extends BaseModule {
	async register(
		merchantId: string,
		accountId: string,
		body: RegisterQrCodeBody,
	): Promise<QrCodeRegistered> {
		const { data } = await this.fetch.POST("/sbp/v1.0/qr-code/merchant/{merchantId}/{accountId}", {
			params: { path: { merchantId, accountId } },
			body: { Data: body },
		});
		return this.unwrap(data, "sbp.qrCodes.register");
	}

	async list(legalId: string): Promise<QrCodeList> {
		const { data } = await this.fetch.GET("/sbp/v1.0/qr-code/legal-entity/{legalId}", {
			params: { path: { legalId } },
		});
		return this.unwrap(data, "sbp.qrCodes.list");
	}

	async get(qrcId: string): Promise<QrCode> {
		const { data } = await this.fetch.GET("/sbp/v1.0/qr-code/{qrcId}", {
			params: { path: { qrcId } },
		});
		return this.unwrap(data, "sbp.qrCodes.get");
	}

	/** Статусы оплаты по списку QR-кодов (разделённых запятой). */
	async getPaymentStatus(qrcIds: string | string[]): Promise<QrCodesPaymentStatus> {
		const joined = Array.isArray(qrcIds) ? qrcIds.join(",") : qrcIds;
		const { data } = await this.fetch.GET("/sbp/v1.0/qr-codes/{qrcIds}/payment-status", {
			params: { path: { qrcIds: joined } },
		});
		return this.unwrap(data, "sbp.qrCodes.getPaymentStatus");
	}
}

/** Кассовые QR-коды СБП. */
export class SbpCashboxQrCodesModule extends BaseModule {
	async register(body: RegisterCashboxQrCodeRequest): Promise<RegisteredCashboxQrCode> {
		const { data } = await this.fetch.POST("/sbp/v1.0/cashbox-qr-code", {
			body: { Data: body },
		});
		return this.unwrap(data, "sbp.cashboxQrCodes.register");
	}

	async list(merchantId: string, accountId: string): Promise<CashboxQrCodeList> {
		const { data } = await this.fetch.GET(
			"/sbp/v1.0/cashbox-qr-code/merchant/{merchantId}/{accountId}",
			{ params: { path: { merchantId, accountId } } },
		);
		return this.unwrap(data, "sbp.cashboxQrCodes.list");
	}

	async get(qrcId: string, body: GetCashboxQrCodeRequest): Promise<CashboxQrCode> {
		const { data } = await this.fetch.POST("/sbp/v1.0/cashbox-qr-code/{qrcId}", {
			params: { path: { qrcId } },
			body: { Data: body },
		});
		return this.unwrap(data, "sbp.cashboxQrCodes.get");
	}

	async changeAccount(qrcId: string, body: ChangeCashboxAccountRequest): Promise<boolean> {
		const { data } = await this.fetch.POST("/sbp/v1.0/cashbox-qr-code/{qrcId}/account", {
			params: { path: { qrcId } },
			body: { Data: body },
		});
		return this.unwrapBoolean(data, "sbp.cashboxQrCodes.changeAccount");
	}

	async activate(qrcId: string, body: ActivateCashboxQrCodeRequest): Promise<unknown> {
		const { data } = await this.fetch.POST("/sbp/v1.0/cashbox-qr-code/{qrcId}/activate", {
			params: { path: { qrcId } },
			body: { Data: body },
		});
		return this.unwrap(data, "sbp.cashboxQrCodes.activate");
	}

	async deactivate(qrcId: string): Promise<boolean> {
		const { data } = await this.fetch.POST("/sbp/v1.0/cashbox-qr-code/{qrcId}/deactivate", {
			params: { path: { qrcId } },
		});
		return this.unwrapBoolean(data, "sbp.cashboxQrCodes.deactivate");
	}

	async getStatus(qrcId: string): Promise<unknown> {
		const { data } = await this.fetch.GET("/sbp/v1.0/cashbox-qr-code/{qrcId}/status", {
			params: { path: { qrcId } },
		});
		return this.unwrap(data, "sbp.cashboxQrCodes.getStatus");
	}

	async getOperation(qrcId: string, paramsId: string): Promise<unknown> {
		const { data } = await this.fetch.GET("/sbp/v1.0/cashbox-qr-code/{qrcId}/operation", {
			params: { path: { qrcId }, query: { paramsId } },
		});
		return this.unwrap(data, "sbp.cashboxQrCodes.getOperation");
	}
}

/** B2B QR-коды СБП. */
export class SbpB2BQrCodesModule extends BaseModule {
	async register(
		merchantId: string,
		accountId: string,
		body: RegisterB2BQrCodeBody,
	): Promise<B2BQrCodeRegistered> {
		const { data } = await this.fetch.POST(
			"/sbp/v1.0/b2b-qr-code/merchant/{merchantId}/{accountId}",
			{
				params: { path: { merchantId, accountId } },
				body: { Data: body },
			},
		);
		return this.unwrap(data, "sbp.b2bQrCodes.register");
	}

	async get(qrcId: string, opts: { width?: number; height?: number } = {}): Promise<B2BQrCode> {
		const { data } = await this.fetch.GET("/sbp/v1.0/b2b-qr-code/{qrcId}", {
			params: { path: { qrcId }, query: opts },
		});
		return this.unwrap(data, "sbp.b2bQrCodes.get");
	}
}

/** Возвраты по СБП. */
export class SbpRefundsModule extends BaseModule {
	async start(body: SbpRefundBody): Promise<SbpRefundRequested> {
		const { data } = await this.fetch.POST("/sbp/v1.0/refund", {
			body: { Data: body },
		});
		return this.unwrap(data, "sbp.refunds.start");
	}

	async get(requestId: string): Promise<SbpRefundStatus> {
		const { data } = await this.fetch.GET("/sbp/v1.0/refund/{request_id}", {
			params: { path: { request_id: requestId } },
		});
		return this.unwrap(data, "sbp.refunds.get");
	}
}

/** Корневой модуль СБП: объединяет все подмодули. */
export class SbpModule extends BaseModule {
	readonly legalEntity: SbpLegalEntityModule;
	readonly merchants: SbpMerchantsModule;
	readonly qrCodes: SbpQrCodesModule;
	readonly cashboxQrCodes: SbpCashboxQrCodesModule;
	readonly b2bQrCodes: SbpB2BQrCodesModule;
	readonly refunds: SbpRefundsModule;

	constructor(fetch: TochkaFetchClient, customerCode: string | undefined) {
		super(fetch, customerCode);
		this.legalEntity = new SbpLegalEntityModule(fetch, customerCode);
		this.merchants = new SbpMerchantsModule(fetch, customerCode);
		this.qrCodes = new SbpQrCodesModule(fetch, customerCode);
		this.cashboxQrCodes = new SbpCashboxQrCodesModule(fetch, customerCode);
		this.b2bQrCodes = new SbpB2BQrCodesModule(fetch, customerCode);
		this.refunds = new SbpRefundsModule(fetch, customerCode);
	}

	/** Информация о клиенте в СБП по `customerCode` и `bankCode`. */
	async customerInfo(customerCode: string, bankCode: string): Promise<SbpCustomerInfo> {
		const { data } = await this.fetch.GET("/sbp/v1.0/customer/{customerCode}/{bankCode}", {
			params: { path: { customerCode, bankCode } },
		});
		return this.unwrap(data, "sbp.customerInfo");
	}

	/** Список платежей по СБП. */
	async payments(
		opts: {
			customerCode?: string;
			qrcId?: string;
			fromDate?: string;
			toDate?: string;
			page?: number;
			perPage?: number;
		} = {},
	): Promise<SbpPayments> {
		const customerCode = opts.customerCode ?? this.requireCustomerCode("sbp.payments");
		const { data } = await this.fetch.GET("/sbp/v1.0/get-sbp-payments", {
			params: { query: { ...opts, customerCode } },
		});
		return this.unwrap(data, "sbp.payments");
	}
}
