import type { components } from "../_generated/schema.js";
import { BaseModule } from "./base.js";

export type Account = components["schemas"]["AccountModel"];
export type AccountList = components["schemas"]["AccountListModel"];
export type BalanceList = components["schemas"]["BalanceListModel"];
export type CardTransactionList = components["schemas"]["CardTransactionListModel"];

export class AccountsModule extends BaseModule {
	async list(): Promise<AccountList> {
		const { data } = await this.fetch.GET("/open-banking/v1.0/accounts");
		return this.unwrap(data, "accounts.list");
	}

	async get(accountId: string): Promise<Account> {
		const { data } = await this.fetch.GET("/open-banking/v1.0/accounts/{accountId}", {
			params: { path: { accountId } },
		});
		return this.unwrap(data, "accounts.get");
	}

	async balances(accountId: string): Promise<BalanceList> {
		const { data } = await this.fetch.GET("/open-banking/v1.0/accounts/{accountId}/balances", {
			params: { path: { accountId } },
		});
		return this.unwrap(data, "accounts.balances");
	}

	/** Незавершённые карточные операции (авторизации). */
	async authorizedCardTransactions(accountId: string): Promise<CardTransactionList> {
		const { data } = await this.fetch.GET(
			"/open-banking/v1.0/accounts/{accountId}/authorized-card-transactions",
			{ params: { path: { accountId } } },
		);
		return this.unwrap(data, "accounts.authorizedCardTransactions");
	}
}
