import type { components } from "../_generated/schema.js";
import type { TochkaFetchClient } from "../core/http.js";
import { BaseModule } from "./base.js";

export type InvoiceCreateRequest = components["schemas"]["InvoiceCreateRequestModel"];
export type ClosingDocumentCreateRequest =
	components["schemas"]["ClosingDocumentCreateRequestModel"];
export type DocumentCreateResponse = components["schemas"]["DocumentCreateResponse"];
export type InvoicePaymentStatus = components["schemas"]["InvoicePaymentStatusResponse"];

export class BillsModule extends BaseModule {
	async create(body: InvoiceCreateRequest): Promise<DocumentCreateResponse> {
		const { data } = await this.fetch.POST("/invoice/v1.0/bills", {
			body: { Data: body },
		});
		return this.unwrap(data, "bills.create");
	}

	async delete(customerCode: string, documentId: string): Promise<boolean> {
		const { data } = await this.fetch.DELETE("/invoice/v1.0/bills/{customerCode}/{documentId}", {
			params: { path: { customerCode, documentId } },
		});
		return this.unwrapBoolean(data, "bills.delete");
	}

	async sendToEmail(customerCode: string, documentId: string, email: string): Promise<boolean> {
		const { data } = await this.fetch.POST(
			"/invoice/v1.0/bills/{customerCode}/{documentId}/email",
			{
				params: { path: { customerCode, documentId } },
				body: { Data: { email } },
			},
		);
		return this.unwrapBoolean(data, "bills.sendToEmail");
	}

	/** Скачать PDF счёта. */
	async getFile(customerCode: string, documentId: string): Promise<Blob> {
		const { data } = await this.fetch.GET("/invoice/v1.0/bills/{customerCode}/{documentId}/file", {
			params: { path: { customerCode, documentId } },
			parseAs: "blob",
		});
		return data as unknown as Blob;
	}

	async getPaymentStatus(customerCode: string, documentId: string): Promise<InvoicePaymentStatus> {
		const { data } = await this.fetch.GET(
			"/invoice/v1.0/bills/{customerCode}/{documentId}/payment-status",
			{ params: { path: { customerCode, documentId } } },
		);
		return this.unwrap(data, "bills.getPaymentStatus");
	}
}

export class ClosingDocumentsModule extends BaseModule {
	async create(body: ClosingDocumentCreateRequest): Promise<DocumentCreateResponse> {
		const { data } = await this.fetch.POST("/invoice/v1.0/closing-documents", {
			body: { Data: body },
		});
		return this.unwrap(data, "closingDocuments.create");
	}

	async delete(customerCode: string, documentId: string): Promise<boolean> {
		const { data } = await this.fetch.DELETE(
			"/invoice/v1.0/closing-documents/{customerCode}/{documentId}",
			{ params: { path: { customerCode, documentId } } },
		);
		return this.unwrapBoolean(data, "closingDocuments.delete");
	}

	async sendToEmail(customerCode: string, documentId: string, email: string): Promise<boolean> {
		const { data } = await this.fetch.POST(
			"/invoice/v1.0/closing-documents/{customerCode}/{documentId}/email",
			{
				params: { path: { customerCode, documentId } },
				body: { Data: { email } },
			},
		);
		return this.unwrapBoolean(data, "closingDocuments.sendToEmail");
	}

	async getFile(customerCode: string, documentId: string): Promise<Blob> {
		const { data } = await this.fetch.GET(
			"/invoice/v1.0/closing-documents/{customerCode}/{documentId}/file",
			{
				params: { path: { customerCode, documentId } },
				parseAs: "blob",
			},
		);
		return data as unknown as Blob;
	}
}

export class InvoiceModule {
	readonly bills: BillsModule;
	readonly closingDocuments: ClosingDocumentsModule;

	constructor(fetch: TochkaFetchClient, customerCode: string | undefined) {
		this.bills = new BillsModule(fetch, customerCode);
		this.closingDocuments = new ClosingDocumentsModule(fetch, customerCode);
	}
}
