import type { components } from "../_generated/pay-gateway.js";
import type { PayGatewayClient } from "./client.js";
import { sitePath } from "./paths.js";

type Schemas = components["schemas"];

export type CreateInvoiceRequest = Schemas["CreateInvoiceRequestDTO"];
export type CancelInvoiceRequest = Schemas["CancelInvoiceRequestDTO"];
export type PayGatewayInvoice = Schemas["InvoiceResponseDTO"];

export class PayGatewayInvoicesModule {
	constructor(private readonly client: PayGatewayClient) {}

	create(siteUid: string, body: CreateInvoiceRequest): Promise<PayGatewayInvoice> {
		return this.client.request("POST", sitePath(siteUid, "/invoices"), { Data: body });
	}

	get(siteUid: string, invoiceUid: string): Promise<PayGatewayInvoice> {
		return this.client.request(
			"GET",
			sitePath(siteUid, `/invoices/${encodeURIComponent(invoiceUid)}`),
		);
	}

	cancel(
		siteUid: string,
		invoiceUid: string,
		body: CancelInvoiceRequest = {},
	): Promise<PayGatewayInvoice> {
		return this.client.request(
			"POST",
			sitePath(siteUid, `/invoices/${encodeURIComponent(invoiceUid)}/cancel`),
			{ Data: body },
		);
	}
}
