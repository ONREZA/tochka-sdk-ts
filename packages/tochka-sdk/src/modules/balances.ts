import type { components } from "../_generated/schema.js";
import { BaseModule } from "./base.js";

export type Balance = components["schemas"]["BalanceModel"];
export type BalanceList = components["schemas"]["BalanceListModel"];

export class BalancesModule extends BaseModule {
	/** Балансы по всем счетам всех доступных клиентов. */
	async list(): Promise<BalanceList> {
		const { data } = await this.fetch.GET("/open-banking/v1.0/balances");
		return this.unwrap(data, "balances.list");
	}
}
