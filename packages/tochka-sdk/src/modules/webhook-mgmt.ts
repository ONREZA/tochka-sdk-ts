import type { components } from "../_generated/schema.js";
import { BaseModule } from "./base.js";

export type Webhook = components["schemas"]["Webhook"];
export type WebhookType = components["schemas"]["WebhookTypeEnum"];
export type WebhookEditRequest = components["schemas"]["WebhookEditRequest"];

/**
 * Управление вебхуками приложения. Требует разрешение `ManageWebhookData`.
 * Для верификации тела вебхука см. `@onreza/tochka-sdk/webhooks`.
 */
export class WebhooksMgmtModule extends BaseModule {
	/** Получить зарегистрированный вебхук приложения. */
	async get(clientId: string): Promise<Webhook> {
		const { data } = await this.fetch.GET("/webhook/v1.0/{client_id}", {
			params: { path: { client_id: clientId } },
		});
		return this.unwrap(data, "webhooks.get");
	}

	/** Создать вебхук. */
	async create(clientId: string, body: Webhook): Promise<Webhook> {
		const { data } = await this.fetch.PUT("/webhook/v1.0/{client_id}", {
			params: { path: { client_id: clientId } },
			body,
		});
		return this.unwrap(data, "webhooks.create");
	}

	/** Изменить URL или список событий. */
	async edit(clientId: string, body: WebhookEditRequest): Promise<Webhook> {
		const { data } = await this.fetch.POST("/webhook/v1.0/{client_id}", {
			params: { path: { client_id: clientId } },
			body,
		});
		return this.unwrap(data, "webhooks.edit");
	}

	/** Удалить вебхук. Возвращает `true` при успехе. */
	async delete(clientId: string): Promise<boolean> {
		const { data } = await this.fetch.DELETE("/webhook/v1.0/{client_id}", {
			params: { path: { client_id: clientId } },
		});
		return this.unwrapBoolean(data, "webhooks.delete");
	}

	/** Отправить тестовый вебхук заданного типа. */
	async testSend(clientId: string, webhookType: WebhookType): Promise<boolean> {
		const { data } = await this.fetch.POST("/webhook/v1.0/{client_id}/test_send", {
			params: { path: { client_id: clientId } },
			body: { webhookType },
		});
		return this.unwrapBoolean(data, "webhooks.testSend");
	}
}
