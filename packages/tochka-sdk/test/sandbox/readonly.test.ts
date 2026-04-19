import { describe, expect, test } from "bun:test";
import { makeSmokeClient, resolveCustomerCode, skipIfNoSmoke } from "./_setup.js";

describe.skipIf(skipIfNoSmoke)("sandbox: accounts", () => {
	test("list возвращает массив счетов", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		const list = await client.forCustomer(code).accounts.list();
		expect(Array.isArray(list.Account)).toBe(true);
		expect(list.Account.length).toBeGreaterThan(0);
		const acc = list.Account[0];
		expect(acc).toBeDefined();
		if (acc) {
			expect(typeof acc.accountId).toBe("string");
			expect(typeof acc.currency).toBe("string");
			expect(typeof acc.customerCode).toBe("string");
		}
	});

	test("get по accountId возвращает тот же счёт", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		const scoped = client.forCustomer(code);
		const list = await scoped.accounts.list();
		const first = list.Account[0];
		if (!first) throw new Error("accounts.list пуст");
		const account = await scoped.accounts.get(first.accountId);
		expect(account.accountId).toBe(first.accountId);
	});

	test("balances по accountId возвращает массив балансов", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		const scoped = client.forCustomer(code);
		const list = await scoped.accounts.list();
		const first = list.Account[0];
		if (!first) throw new Error("accounts.list пуст");
		const balances = await scoped.accounts.balances(first.accountId);
		expect(Array.isArray(balances.Balance)).toBe(true);
	});
});

describe.skipIf(skipIfNoSmoke)("sandbox: balances", () => {
	test("list возвращает общий массив балансов", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		const list = await client.forCustomer(code).balances.list();
		expect(Array.isArray(list.Balance)).toBe(true);
	});
});

describe.skipIf(skipIfNoSmoke)("sandbox: statements", () => {
	test("list возвращает массив выписок (может быть пустой)", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		const list = await client.forCustomer(code).statements.list({ limit: 5 });
		expect(Array.isArray(list.Statement)).toBe(true);
	});

	test("init создаёт выписку и возвращает statementId", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		const scoped = client.forCustomer(code);
		const accounts = await scoped.accounts.list();
		const first = accounts.Account[0];
		if (!first) throw new Error("accounts.list пуст");

		const today = new Date();
		const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
		const fmt = (d: Date): string => d.toISOString().slice(0, 10);

		const initResp = await scoped.statements.init({
			accountId: first.accountId,
			startDateTime: fmt(weekAgo),
			endDateTime: fmt(today),
		});
		expect(initResp.Statement).toBeDefined();
		expect(typeof initResp.Statement.statementId).toBe("string");
	});
});

describe.skipIf(skipIfNoSmoke)("sandbox: customers.get", () => {
	test("get по customerCode возвращает совпадающий код", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		const c = await client.forCustomer(code).customers.get();
		expect(c.customerCode).toBe(code);
	});
});
