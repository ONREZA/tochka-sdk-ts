import { describe, expect, test } from "bun:test";
import { TochkaClient } from "../../src/client.js";
import { TochkaSDKError } from "../../src/errors/index.js";
import type { AcquiringCreateSubscriptionWithReceiptRequest } from "../../src/modules/acquiring.js";

interface Captured {
	url?: string;
	method?: string;
}

function makeClient(captured: Captured) {
	const fetchImpl = (async (input: Request | string, init?: RequestInit) => {
		if (input instanceof Request) {
			captured.url = input.url;
			captured.method = input.method;
		} else {
			captured.url = String(input);
			captured.method = init?.method;
		}
		return new Response(JSON.stringify({ Data: { subscriptionId: "sub-1", status: "pending" } }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as unknown as typeof fetch;
	return new TochkaClient({ auth: { sandbox: true }, fetch: fetchImpl });
}

const base = { amount: 100, customerCode: "300000092", purpose: "Подписка" };

describe("AcquiringSubscriptionsModule — Options XOR recurring", () => {
	test("create: Options + recurring вместе → TochkaSDKError, запрос не уходит", async () => {
		const cap: Captured = {};
		const client = makeClient(cap);
		await expect(
			client.acquiring.subscriptions.create({
				...base,
				recurring: true,
				Options: { trancheCount: 12, period: "Month" },
			}),
		).rejects.toBeInstanceOf(TochkaSDKError);
		expect(cap.url).toBeUndefined();
	});

	test("createWithReceipt: Options + recurring вместе → тоже TochkaSDKError", async () => {
		const cap: Captured = {};
		const client = makeClient(cap);
		const body = {
			...base,
			recurring: true,
			Options: { trancheCount: 6, period: "Month" },
		} as unknown as AcquiringCreateSubscriptionWithReceiptRequest;
		await expect(client.acquiring.subscriptions.createWithReceipt(body)).rejects.toBeInstanceOf(
			TochkaSDKError,
		);
		expect(cap.url).toBeUndefined();
	});

	test("только Options (авто-график) → запрос уходит", async () => {
		const cap: Captured = {};
		const client = makeClient(cap);
		await client.acquiring.subscriptions.create({
			...base,
			Options: { trancheCount: 12, period: "Month" },
		});
		expect(cap.method).toBe("POST");
		expect(cap.url).toContain("/acquiring/v1.0/subscriptions");
	});

	test("только recurring: true (ручные списания) → запрос уходит", async () => {
		const cap: Captured = {};
		const client = makeClient(cap);
		await client.acquiring.subscriptions.create({ ...base, recurring: true });
		expect(cap.method).toBe("POST");
		expect(cap.url).toContain("/acquiring/v1.0/subscriptions");
	});

	test("recurring: false + Options → валидно (recurring не активен)", async () => {
		const cap: Captured = {};
		const client = makeClient(cap);
		await client.acquiring.subscriptions.create({
			...base,
			recurring: false,
			Options: { trancheCount: 12, period: "Month" },
		});
		expect(cap.url).toContain("/acquiring/v1.0/subscriptions");
	});
});
