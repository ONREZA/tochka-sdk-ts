import type { components } from "../_generated/schema.js";
import type { TochkaFetchClient } from "../core/http.js";
import { BaseModule } from "./base.js";

export type AcquiringPaymentStatus = components["schemas"]["AcquiringPaymentStatus"];
export type AcquiringCreatePaymentRequest =
	components["schemas"]["AcquiringCreatePaymentOperationRequestModel"];
export type AcquiringCreatePaymentResponse =
	components["schemas"]["AcquiringCreatePaymentOperationResponseModel"];
export type AcquiringPaymentList =
	components["schemas"]["AcquiringGetPaymentOperationListResponseModel"];
export type AcquiringRefundRequest =
	components["schemas"]["AcquiringPaymentOrderRefundRequestModel"];
export type AcquiringRefundResponse = components["schemas"]["AcquiringPaymentOperationRefundModel"];
export type AcquiringCreatePaymentWithReceiptRequest =
	components["schemas"]["AcquiringCreatePaymentOperationWithReceiptRequestModel"];
export type AcquiringCreatePaymentWithReceiptResponse =
	components["schemas"]["AcquiringCreatePaymentOperationWithReceiptResponseModel"];

export type AcquiringCreateSubscriptionRequest =
	components["schemas"]["AcquiringCreateSubscriptionRequestModel"];
export type AcquiringCreateSubscriptionResponse =
	components["schemas"]["AcquiringCreateSubscriptionResponseModel"];
export type AcquiringSubscriptionList =
	components["schemas"]["AcquiringSubscriptionListResponseModel"];
export type AcquiringChargeSubscriptionRequest =
	components["schemas"]["AcquiringChargeSubscriptionRequestModel"];
export type AcquiringSetSubscriptionStatusRequest =
	components["schemas"]["AcquiringSetSubscriptionStatusRequestModel"];
export type AcquiringSubscriptionStatus =
	components["schemas"]["AcquiringGetSubscriptionStatusResponseModel"];
export type AcquiringCreateSubscriptionWithReceiptRequest =
	components["schemas"]["AcquiringCreateSubscriptionWithReceiptRequestModel"];
export type AcquiringCreateSubscriptionWithReceiptResponse =
	components["schemas"]["AcquiringCreateSubscriptionWithReceiptResponseModel"];

export type AcquiringRegistry = components["schemas"]["AcquiringPaymentRegistryModel"];
export type AcquiringRetailerList = components["schemas"]["AcquiringRetailerListModel"];

export class AcquiringPaymentsModule extends BaseModule {
	/** Создать платёжную ссылку. */
	async create(body: AcquiringCreatePaymentRequest): Promise<AcquiringCreatePaymentResponse> {
		const { data } = await this.fetch.POST("/acquiring/v1.0/payments", {
			body: { Data: body },
		});
		return this.unwrap(data, "acquiring.payments.create");
	}

	/** Создать платёжную ссылку с чеком. */
	async createWithReceipt(
		body: AcquiringCreatePaymentWithReceiptRequest,
	): Promise<AcquiringCreatePaymentWithReceiptResponse> {
		const { data } = await this.fetch.POST("/acquiring/v1.0/payments_with_receipt", {
			body: { Data: body },
		});
		return this.unwrap(data, "acquiring.payments.createWithReceipt");
	}

	/** Список операций по платёжным ссылкам. */
	async list(
		opts: {
			customerCode?: string;
			fromDate?: string;
			toDate?: string;
			page?: number;
			perPage?: number;
			status?: AcquiringPaymentStatus;
		} = {},
	): Promise<AcquiringPaymentList> {
		const customerCode = opts.customerCode ?? this.requireCustomerCode("acquiring.payments.list");
		const { data } = await this.fetch.GET("/acquiring/v1.0/payments", {
			params: { query: { ...opts, customerCode } },
		});
		return this.unwrap(data, "acquiring.payments.list");
	}

	/** Получить информацию об операции. */
	async get(operationId: string): Promise<AcquiringPaymentList> {
		const { data } = await this.fetch.GET("/acquiring/v1.0/payments/{operationId}", {
			params: { path: { operationId } },
		});
		return this.unwrap(data, "acquiring.payments.get");
	}

	/** Подтвердить платёж (для двухэтапной оплаты). */
	async capture(operationId: string): Promise<boolean> {
		const { data } = await this.fetch.POST("/acquiring/v1.0/payments/{operationId}/capture", {
			params: { path: { operationId } },
		});
		return this.unwrapBoolean(data, "acquiring.payments.capture");
	}

	/** Вернуть (полностью или частично) оплату по ссылке. */
	async refund(
		operationId: string,
		body: AcquiringRefundRequest,
	): Promise<AcquiringRefundResponse> {
		const { data } = await this.fetch.POST("/acquiring/v1.0/payments/{operationId}/refund", {
			params: { path: { operationId } },
			body: { Data: body },
		});
		return this.unwrap(data, "acquiring.payments.refund");
	}
}

export class AcquiringSubscriptionsModule extends BaseModule {
	async create(
		body: AcquiringCreateSubscriptionRequest,
	): Promise<AcquiringCreateSubscriptionResponse> {
		const { data } = await this.fetch.POST("/acquiring/v1.0/subscriptions", {
			body: { Data: body },
		});
		return this.unwrap(data, "acquiring.subscriptions.create");
	}

	async createWithReceipt(
		body: AcquiringCreateSubscriptionWithReceiptRequest,
	): Promise<AcquiringCreateSubscriptionWithReceiptResponse> {
		const { data } = await this.fetch.POST("/acquiring/v1.0/subscriptions_with_receipt", {
			body: { Data: body },
		});
		return this.unwrap(data, "acquiring.subscriptions.createWithReceipt");
	}

	async list(
		opts: {
			customerCode?: string;
			page?: number;
			perPage?: number;
			recurring?: boolean;
		} = {},
	): Promise<AcquiringSubscriptionList> {
		const customerCode =
			opts.customerCode ?? this.requireCustomerCode("acquiring.subscriptions.list");
		const { data } = await this.fetch.GET("/acquiring/v1.0/subscriptions", {
			params: { query: { ...opts, customerCode } },
		});
		return this.unwrap(data, "acquiring.subscriptions.list");
	}

	/** Списать по рекуррентной подписке. */
	async charge(operationId: string, body: AcquiringChargeSubscriptionRequest): Promise<boolean> {
		const { data } = await this.fetch.POST("/acquiring/v1.0/subscriptions/{operationId}/charge", {
			params: { path: { operationId } },
			body: { Data: body },
		});
		return this.unwrapBoolean(data, "acquiring.subscriptions.charge");
	}

	async getStatus(operationId: string): Promise<AcquiringSubscriptionStatus> {
		const { data } = await this.fetch.GET("/acquiring/v1.0/subscriptions/{operationId}/status", {
			params: { path: { operationId } },
		});
		return this.unwrap(data, "acquiring.subscriptions.getStatus");
	}

	async setStatus(
		operationId: string,
		body: AcquiringSetSubscriptionStatusRequest,
	): Promise<boolean> {
		const { data } = await this.fetch.POST("/acquiring/v1.0/subscriptions/{operationId}/status", {
			params: { path: { operationId } },
			body: { Data: body },
		});
		return this.unwrapBoolean(data, "acquiring.subscriptions.setStatus");
	}
}

export class AcquiringRegistryModule extends BaseModule {
	/** Получить реестр операций эквайринга. */
	async get(opts: {
		customerCode?: string;
		merchantId: string;
		date: string;
		paymentId?: string;
	}): Promise<AcquiringRegistry> {
		const customerCode = opts.customerCode ?? this.requireCustomerCode("acquiring.registry.get");
		const { data } = await this.fetch.GET("/acquiring/v1.0/registry", {
			params: { query: { ...opts, customerCode } },
		});
		return this.unwrap(data, "acquiring.registry.get");
	}
}

export class AcquiringRetailersModule extends BaseModule {
	async list(customerCode?: string): Promise<AcquiringRetailerList> {
		const code = customerCode ?? this.requireCustomerCode("acquiring.retailers.list");
		const { data } = await this.fetch.GET("/acquiring/v1.0/retailers", {
			params: { query: { customerCode: code } },
		});
		return this.unwrap(data, "acquiring.retailers.list");
	}
}

export class AcquiringModule {
	readonly payments: AcquiringPaymentsModule;
	readonly subscriptions: AcquiringSubscriptionsModule;
	readonly registry: AcquiringRegistryModule;
	readonly retailers: AcquiringRetailersModule;

	constructor(fetch: TochkaFetchClient, customerCode: string | undefined) {
		this.payments = new AcquiringPaymentsModule(fetch, customerCode);
		this.subscriptions = new AcquiringSubscriptionsModule(fetch, customerCode);
		this.registry = new AcquiringRegistryModule(fetch, customerCode);
		this.retailers = new AcquiringRetailersModule(fetch, customerCode);
	}
}
