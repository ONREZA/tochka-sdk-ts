import type { components } from "../_generated/schema.js";
import { BaseModule } from "./base.js";

export type Consent = components["schemas"]["ConsentModel"];
export type ConsentList = components["schemas"]["ConsentListModel"];
export type ConsentCreateRequest = components["schemas"]["ConsentCreateRequestModel"];

/**
 * Управление разрешениями (consents) для OAuth-flow.
 * Технический токен (`client_credentials`) создаёт consent, который пользователь
 * затем подтверждает в `/connect/authorize`.
 *
 * @see docs/tochka/scraped-tochka-api/algoritm-raboty-po-oauth-2.0.md
 */
export class ConsentsModule extends BaseModule {
	/** Создать новое разрешение. */
	async create(body: ConsentCreateRequest): Promise<ConsentList> {
		const { data } = await this.fetch.POST("/consent/v1.0/consents", {
			body: { Data: body },
		});
		return this.unwrap(data, "consents.create");
	}

	/** Получить список всех разрешений, выданных приложению. */
	async list(): Promise<ConsentList> {
		const { data } = await this.fetch.GET("/consent/v1.0/consents");
		return this.unwrap(data, "consents.list");
	}

	/** Получить конкретное разрешение. */
	async get(consentId: string): Promise<Consent> {
		const { data } = await this.fetch.GET("/consent/v1.0/consents/{consentId}", {
			params: { path: { consentId } },
		});
		return this.unwrap(data, "consents.get");
	}

	/** Получить дочерние разрешения. */
	async listChildren(consentId: string): Promise<ConsentList> {
		const { data } = await this.fetch.GET("/consent/v1.0/consents/{consentId}/child", {
			params: { path: { consentId } },
		});
		return this.unwrap(data, "consents.listChildren");
	}
}
