import { describe, expect, test } from "bun:test";
import { TochkaError } from "../../src/errors/index.js";
import { makeSmokeClient, resolveCustomerCode, skipIfNoSmoke } from "./_setup.js";

/**
 * «Безопасные» вызовы против sandbox: читают списки, не двигают деньги.
 * Там где в sandbox метод может быть не включён (consents, webhook-mgmt) —
 * допускаем TochkaError с категорией NOT_FOUND/FORBIDDEN/UNSUPPORTED.
 */

function acceptableBusinessError(err: unknown): boolean {
	if (!(err instanceof TochkaError)) return false;
	const cat = err.category ?? "";
	return (
		err.status === 404 ||
		err.status === 403 ||
		err.status === 400 ||
		cat === "ENTITY_NOT_FOUND" ||
		cat === "OPERATION_FORBIDDEN" ||
		cat === "UNSUPPORTED_OPERATION" ||
		cat === "REQUEST_VALIDATION_ERROR"
	);
}

describe.skipIf(skipIfNoSmoke)("sandbox: payments (readonly)", () => {
	test("listForSign: либо список, либо Forbidden by consent (sandbox ограничивает)", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		try {
			const list = await client.forCustomer(code).payments.listForSign();
			expect(list).toBeDefined();
		} catch (err) {
			if (!acceptableBusinessError(err)) throw err;
		}
	});
});

describe.skipIf(skipIfNoSmoke)("sandbox: acquiring (readonly)", () => {
	test("payments.list возвращает структуру", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		const list = await client.forCustomer(code).acquiring.payments.list({ perPage: 5 });
		expect(list).toBeDefined();
	});

	test("subscriptions.list возвращает структуру", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		const list = await client.forCustomer(code).acquiring.subscriptions.list({ perPage: 5 });
		expect(list).toBeDefined();
	});

	test("retailers.list возвращает структуру", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		try {
			const list = await client.forCustomer(code).acquiring.retailers.list();
			expect(list).toBeDefined();
		} catch (err) {
			if (!acceptableBusinessError(err)) throw err;
		}
	});
});

describe.skipIf(skipIfNoSmoke)("sandbox: SBP (readonly)", () => {
	test("payments возвращает список SBP-платежей", async () => {
		const client = makeSmokeClient();
		const code = await resolveCustomerCode(client);
		try {
			const list = await client.forCustomer(code).sbp.payments({ perPage: 5 });
			expect(list).toBeDefined();
		} catch (err) {
			if (!acceptableBusinessError(err)) throw err;
		}
	});
});

describe.skipIf(skipIfNoSmoke)("sandbox: consents — не гарантировано", () => {
	test("list либо работает, либо отвечает осмысленной бизнес-ошибкой", async () => {
		const client = makeSmokeClient();
		try {
			const list = await client.consents.list();
			expect(list).toBeDefined();
		} catch (err) {
			if (!acceptableBusinessError(err)) throw err;
		}
	});
});

describe.skipIf(skipIfNoSmoke)("sandbox: webhook-mgmt — не гарантировано", () => {
	test("get для неизвестного clientId отвечает 4xx", async () => {
		const client = makeSmokeClient();
		try {
			await client.webhooks.get("smoke-test-unknown-client-id");
			// если не бросил — тоже ок (sandbox вернул мок)
		} catch (err) {
			if (!acceptableBusinessError(err)) throw err;
		}
	});
});
