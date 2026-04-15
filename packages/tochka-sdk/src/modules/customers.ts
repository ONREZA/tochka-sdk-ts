import type { components } from "../_generated/schema.js";
import { BaseModule } from "./base.js";

export type Customer = components["schemas"]["CustomerModel"];
export type CustomerList = components["schemas"]["CustomerListModel"];

/**
 * Работа с клиентами (юрлицами/ИП), привязанными к аккаунту.
 * Требует разрешение `ReadCustomerData`.
 *
 * @see docs/tochka/scraped-tochka-api/opisanie-metodov-klienty.md
 */
export class CustomersModule extends BaseModule {
	/** Получить список доступных клиентов. */
	async list(): Promise<CustomerList> {
		const { data } = await this.fetch.GET("/open-banking/v1.0/customers");
		return this.unwrap(data, "customers.list");
	}

	/** Получить информацию по конкретному клиенту. */
	async get(customerCode?: string): Promise<Customer> {
		const code = customerCode ?? this.requireCustomerCode("customers.get");
		const { data } = await this.fetch.GET("/open-banking/v1.0/customers/{customerCode}", {
			params: { path: { customerCode: code } },
		});
		return this.unwrap(data, "customers.get");
	}
}
