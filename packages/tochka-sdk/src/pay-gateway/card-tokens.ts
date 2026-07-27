import type { components } from "../_generated/pay-gateway.js";
import type { PayGatewayClient } from "./client.js";
import { sitePath } from "./paths.js";

type Schemas = components["schemas"];

export type DeactivateCardTokenRequest = Schemas["DeactivateCardTokenOperation"];

export class PayGatewayCardTokensModule {
	constructor(private readonly client: PayGatewayClient) {}

	/** Деактивировать сохранённый карточный токен. */
	deactivate(siteUid: string, body: DeactivateCardTokenRequest): Promise<Record<string, never>> {
		return this.client.request("POST", sitePath(siteUid, "/card-token-operations"), {
			Data: body,
		});
	}
}
