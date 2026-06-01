import { describe, expect, test } from "bun:test";
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
	test("create → POST .../sbp/qrc, тело плоское (без обёртки Data), без Signature", async () => {
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
		expect(body.Data).toBeUndefined();
		expect(body.qrcType).toBe("DYNAMIC");
		expect(body.siteUid).toBeUndefined();
		expect(body.paymentToken.tokenizationPurpose).toBe("Подписка");
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
		expect(body.qrcType).toBe("TOKEN");
		expect(body.amount).toBeUndefined();
		expect(body.paymentToken.tokenizationServiceDetails).toBeUndefined();
	});

	test("create STATIC без amount — компилируется и шлётся", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap);
		await pg.sbpFunctionalLinks.create({ siteUid: "site-1", qrcType: "STATIC" });
		const body = JSON.parse(cap.body ?? "{}");
		expect(body.qrcType).toBe("STATIC");
		expect(body.amount).toBeUndefined();
	});

	test("extra мержится в тело верхнего уровня", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap);
		await pg.sbpFunctionalLinks.create({
			siteUid: "site-1",
			qrcType: "DYNAMIC",
			extra: { callbackUrl: "https://cb.example" },
		});
		const body = JSON.parse(cap.body ?? "{}");
		expect(body.callbackUrl).toBe("https://cb.example");
		expect(body.extra).toBeUndefined();
	});

	test("getTokenizationResult → GET .../sbp/qrc/{qrcId}/tokenization/result, qrcId кодируется", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, { status: "ACCEPTED", token: "TKN" });
		const res = await pg.sbpFunctionalLinks.getTokenizationResult("site-1", "q/1");
		expect(cap.method).toBe("GET");
		expect(cap.url).toBe(
			"https://pay.example/uapi/pay/v1.0/sites/site-1/sbp/qrc/q%2F1/tokenization/result",
		);
		expect(cap.body).toBeUndefined();
		expect(res.status).toBe("ACCEPTED");
		expect(res.token).toBe("TKN");
	});

	test("getTokenizationResult REJECTED без token", async () => {
		const cap: Captured = {};
		const pg = makeClient(cap, { status: "REJECTED" });
		const res = await pg.sbpFunctionalLinks.getTokenizationResult("site-1", "q1");
		expect(res.status).toBe("REJECTED");
		expect(res.token).toBeUndefined();
	});
});
