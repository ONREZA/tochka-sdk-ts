import { describe, expect, test } from "bun:test";
import { makeSmokeClient, resolveCustomerCode, skipIfNoSmoke } from "./_setup.js";

describe.skipIf(skipIfNoSmoke)("sandbox: client sanity", () => {
	test("customers.list возвращает непустой массив в sandbox", async () => {
		const client = makeSmokeClient();
		const list = await client.customers.list();
		expect(Array.isArray(list.Customer)).toBe(true);
		expect(list.Customer.length).toBeGreaterThan(0);
		const first = list.Customer[0];
		expect(first).toBeDefined();
		if (first) expect(typeof first.customerCode).toBe("string");
	});

	test("resolveCustomerCode даёт рабочий код из списка", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		expect(code.length).toBeGreaterThan(0);
	});

	test("forCustomer наследует auth-provider и фиксирует customerCode", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		const scoped = client.forCustomer(code);
		const c = await scoped.customers.get();
		expect(c.customerCode).toBe(code);
	});
});
