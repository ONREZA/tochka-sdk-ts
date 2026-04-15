import type { components } from "../_generated/schema.js";
import { BaseModule } from "./base.js";

export type Statement = components["schemas"]["StatementModel"];
export type StatementList = components["schemas"]["StatementListModel"];
export type StatementInitRequest = components["schemas"]["StatementInitReqModel"];
export type StatementInitResponse = components["schemas"]["StatementInitResponseModel"];

export class StatementsModule extends BaseModule {
	/** Создать выписку по счёту. Возвращает `statementId` для последующего получения. */
	async init(body: StatementInitRequest): Promise<StatementInitResponse> {
		const { data } = await this.fetch.POST("/open-banking/v1.0/statements", {
			body: { Data: { Statement: body } },
		});
		return this.unwrap(data, "statements.init");
	}

	/** Список запрошенных выписок (ограничено `limit`). */
	async list(opts: { limit?: number } = {}): Promise<StatementList> {
		const init = opts.limit !== undefined ? { params: { query: { limit: opts.limit } } } : {};
		const { data } = await this.fetch.GET("/open-banking/v1.0/statements", init);
		return this.unwrap(data, "statements.list");
	}

	/** Получить выписку по идентификатору. */
	async get(accountId: string, statementId: string): Promise<StatementList> {
		const { data } = await this.fetch.GET(
			"/open-banking/v1.0/accounts/{accountId}/statements/{statementId}",
			{ params: { path: { accountId, statementId } } },
		);
		return this.unwrap(data, "statements.get");
	}
}
