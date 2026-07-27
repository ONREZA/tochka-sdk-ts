import { describe, expect, test } from "bun:test";
import { TochkaUnknownOutcomeError } from "../../src/errors/index.js";
import { PayGatewayClient } from "../../src/pay-gateway/index.js";

interface Captured {
	url?: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
}

function makeClient(captured: Captured, responseBody: unknown = { qrcId: "q1" }) {
	const fetchImpl = (async (url: string, init: RequestInit) => {
		captured.url = url;
		captured.method = init.method;
		captured.headers = init.headers as Record<string, string>;
		captured.body = init.body as string | undefined;
		return new Response(JSON.stringify(responseBody), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as unknown as typeof fetch;
	// privateKey намеренно не задаём — путь /sbp/qrc не подписывается.
	return new PayGatewayClient({
		token: "jwt-token",
		baseUrl: "https://pay.example",
		fetch: fetchImpl,
	});
}

describe("PayGatewaySbpFunctionalLinksModule", () => {
	test("create → POST .../sbp/qrc, тело в Data, без Signature", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap);
		await pg.sbpFunctionalLinks.create({
			siteUid: "site-1",
			qrcType: "DYNAMIC",
			amount: { currency: "RUB", amount: "1.00" },
			paymentToken: {
				tokenizationPurpose: "Подписка",
				tokenizationServiceDetails: { serviceName: "Pro", serviceId: "svc-1" },
			},
			ttl: 60,
		});
		expect(cap.method).toBe("POST");
		expect(cap.url).toBe("https://pay.example/uapi/pay/v1.0/sites/site-1/sbp/qrc");
		const body = JSON.parse(cap.body ?? "{}");
		expect(body.Data.qrcType).toBe("DYNAMIC");
		expect(body.siteUid).toBeUndefined();
		expect(body.Data.paymentToken.tokenizationPurpose).toBe("Подписка");
		expect(cap.headers?.Signature).toBeUndefined();
	});

	test("create TOKEN без оплаты и без tokenizationServiceDetails — компилируется и шлётся", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap);
		await pg.sbpFunctionalLinks.create({
			siteUid: "site-1",
			qrcType: "TOKEN",
			paymentToken: { tokenizationPurpose: "Привязка без оплаты" },
		});
		const body = JSON.parse(cap.body ?? "{}");
		expect(body.Data.qrcType).toBe("TOKEN");
		expect(body.Data.amount).toBeUndefined();
		expect(body.Data.paymentToken.tokenizationServiceDetails).toBeUndefined();
	});

	test("create STATIC без amount — компилируется и шлётся", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap);
		await pg.sbpFunctionalLinks.create({ siteUid: "site-1", qrcType: "STATIC" });
		const body = JSON.parse(cap.body ?? "{}");
		expect(body.Data.qrcType).toBe("STATIC");
		expect(body.Data.amount).toBeUndefined();
	});

	test("extra мержится в тело верхнего уровня", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap);
		await pg.sbpFunctionalLinks.create({
			siteUid: "site-1",
			qrcType: "DYNAMIC",
			amount: { currency: "RUB", amount: "1.00" },
			extra: { callbackUrl: "https://cb.example" },
		});
		const body = JSON.parse(cap.body ?? "{}");
		expect(body.Data.callbackUrl).toBe("https://cb.example");
		expect(body.Data.extra).toBeUndefined();
	});

	test("getTokenizationResult → GET .../tokenization/result с qrcIdType", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, { status: "ACCEPTED", token: "TKN" });
		const res = await pg.sbpFunctionalLinks.getTokenizationResult("site-1", "q/1", "NSPK");
		expect(cap.method).toBe("GET");
		expect(cap.url).toBe(
			"https://pay.example/uapi/pay/v1.0/sites/site-1/sbp/qrc/q%2F1/tokenization/result?qrcIdType=NSPK",
		);
		expect(cap.body).toBeUndefined();
		expect(res.status).toBe("ACCEPTED");
		expect(res.token).toBe("TKN");
	});

	test("getTokenizationResult REJECTED без token", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, { status: "REJECTED" });
		const res = await pg.sbpFunctionalLinks.getTokenizationResult("site-1", "q1", "MERCHANT");
		expect(res.status).toBe("REJECTED");
		expect(res.token).toBeUndefined();
	});

	test("POST не повторяется после 503 по умолчанию", async () => {
		let calls = 0;
		const pg = new PayGatewayClient({
			token: "jwt-token",
			baseUrl: "https://pay.example",
			fetch: (async () => {
				calls += 1;
				return new Response("{}", { status: 503 });
			}) as typeof fetch,
		});
		await expect(
			pg.sbpFunctionalLinks.create({ siteUid: "site-1", qrcType: "STATIC" }),
		).rejects.toThrow();
		expect(calls).toBe(1);
	});

	test("транспортная ошибка POST возвращает unknown outcome", async () => {
		let calls = 0;
		const pg = new PayGatewayClient({
			token: "jwt-token",
			baseUrl: "https://pay.example",
			fetch: (async () => {
				calls += 1;
				throw new TypeError("connection reset");
			}) as typeof fetch,
		});
		await expect(
			pg.sbpFunctionalLinks.create({ siteUid: "site-1", qrcType: "STATIC" }),
		).rejects.toBeInstanceOf(TochkaUnknownOutcomeError);
		expect(calls).toBe(1);
	});
});
