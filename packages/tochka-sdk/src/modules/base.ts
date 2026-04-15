import type { TochkaFetchClient } from "../core/http.js";
import { TochkaSDKError } from "../errors/index.js";

/**
 * Базовый класс для UX-обёрток. Хранит ссылку на низкоуровневый клиент и
 * опциональный `customerCode`, который подмешивается в запросы, где он нужен.
 */
export abstract class BaseModule {
	constructor(
		protected readonly fetch: TochkaFetchClient,
		protected readonly customerCode: string | undefined,
	) {}

	/** Распаковать стандартный ответ Точки `{ Data, Links, Meta }` в полезную нагрузку. */
	protected unwrap<T extends { Data: unknown }>(data: T | undefined, operation: string): T["Data"] {
		if (!data) {
			throw new TochkaSDKError(
				`${operation}: empty response (unexpected — middleware should have thrown)`,
			);
		}
		return data.Data;
	}

	/** Распаковать ответ вида `{ Data: { result: boolean } }`. */
	protected unwrapBoolean(data: { Data: unknown } | undefined, operation: string): boolean {
		const inner = this.unwrap(data, operation);
		return (inner as { result?: boolean }).result ?? true;
	}

	protected requireCustomerCode(operation: string): string {
		if (!this.customerCode) {
			throw new TochkaSDKError(
				`${operation}: customerCode is required. Use \`client.forCustomer(code).${operation}\` or pass an explicit argument.`,
			);
		}
		return this.customerCode;
	}
}
