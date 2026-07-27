import { describe, expect, test } from "bun:test";
import { PayGatewayClient } from "../../src/pay-gateway/index.js";

interface CapturedRequest {
	url: string;
	method: string;
	body?: string;
}

function makeClient(requests: CapturedRequest[]): PayGatewayClient {
	const fetchImpl = (async (url: string, init: RequestInit) => {
		requests.push({
			url,
			method: init.method ?? "GET",
			...(typeof init.body === "string" ? { body: init.body } : {}),
		});
		return new Response(
			JSON.stringify({
				Data: {},
				Links: { self: url },
				Meta: { totalPages: 0 },
			}),
			{ status: 200, headers: { "content-type": "application/json" } },
		);
	}) as unknown as typeof fetch;
	return new PayGatewayClient({
		token: "jwt-token",
		baseUrl: "https://pay.example",
		fetch: fetchImpl,
	});
}

describe("дополнительные модули Pay Gateway", () => {
	test("card tokens и invoices отправляют официальный Data-конверт", async () => {
		const requests: CapturedRequest[] = [];
		const client = makeClient(requests);

		await client.cardTokens.deactivate("site/1", {
			account: "account-1",
			operation: "DEACTIVATE",
			token: "0d7ebfd5-b751-4d52-8df5-b73b252f82df",
		});
		await client.invoices.create("site/1", {
			invoiceUid: "invoice-1",
			amount: { currency: "RUB", amount: "100.00" },
			expirationDateTime: "2026-08-01T12:00:00+03:00",
		});
		await client.invoices.cancel("site/1", "invoice/1", { reason: "Отмена заказа" });
		await client.invoices.get("site/1", "invoice/1");

		expect(requests).toEqual([
			{
				url: "https://pay.example/uapi/pay/v1.0/sites/site%2F1/card-token-operations",
				method: "POST",
				body: JSON.stringify({
					Data: {
						account: "account-1",
						operation: "DEACTIVATE",
						token: "0d7ebfd5-b751-4d52-8df5-b73b252f82df",
					},
				}),
			},
			{
				url: "https://pay.example/uapi/pay/v1.0/sites/site%2F1/invoices",
				method: "POST",
				body: JSON.stringify({
					Data: {
						invoiceUid: "invoice-1",
						amount: { currency: "RUB", amount: "100.00" },
						expirationDateTime: "2026-08-01T12:00:00+03:00",
					},
				}),
			},
			{
				url: "https://pay.example/uapi/pay/v1.0/sites/site%2F1/invoices/invoice%2F1/cancel",
				method: "POST",
				body: JSON.stringify({ Data: { reason: "Отмена заказа" } }),
			},
			{
				url: "https://pay.example/uapi/pay/v1.0/sites/site%2F1/invoices/invoice%2F1",
				method: "GET",
			},
		]);
	});

	test("кассовая ссылка использует qrcIdType и разворачивает void-ответ", async () => {
		const requests: CapturedRequest[] = [];
		const client = makeClient(requests);

		await client.cashRegisterQrc.create("site-1", { merchantQrcId: "merchant-qrc-1" });
		await client.cashRegisterQrc.activate("site-1", "qrc/1", "MERCHANT", {
			activationUid: "activation-1",
			amount: { currency: "RUB", amount: "50.00" },
		});
		const result = await client.cashRegisterQrc.deactivate("site-1", "qrc/1", "MERCHANT");
		await client.cashRegisterQrc.getStatus("site-1", "qrc/1", "MERCHANT");
		await client.cashRegisterQrc.getPayment("site-1", "qrc/1", "activation/1", "MERCHANT");

		expect(result).toBeUndefined();
		expect(requests.map(({ url, method }) => `${method} ${url}`)).toEqual([
			"POST https://pay.example/uapi/pay/v1.0/sites/site-1/sbp/qrc/cash-register-qrc",
			"POST https://pay.example/uapi/pay/v1.0/sites/site-1/sbp/qrc/cash-register-qrc/qrc%2F1/activations?qrcIdType=MERCHANT",
			"DELETE https://pay.example/uapi/pay/v1.0/sites/site-1/sbp/qrc/cash-register-qrc/qrc%2F1/activations/current?qrcIdType=MERCHANT",
			"GET https://pay.example/uapi/pay/v1.0/sites/site-1/sbp/qrc/cash-register-qrc/qrc%2F1/status?qrcIdType=MERCHANT",
			"GET https://pay.example/uapi/pay/v1.0/sites/site-1/sbp/qrc/cash-register-qrc/qrc%2F1/activations/activation%2F1/payment?qrcIdType=MERCHANT",
		]);
	});
});
