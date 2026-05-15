import { describe, expect, test } from "bun:test";
import { PayGatewayClient } from "../../src/pay-gateway/index.js";

interface RecordedRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: string;
}

function makeMockFetch(response: { status?: number; body: unknown }) {
	const calls: RecordedRequest[] = [];
	const fetchImpl: typeof fetch = async (input, init) => {
		const url = typeof input === "string" ? input : (input as Request).url;
		const headers: Record<string, string> = {};
		if (init?.headers instanceof Headers) {
			init.headers.forEach((v, k) => {
				headers[k] = v;
			});
		} else if (Array.isArray(init?.headers)) {
			for (const [k, v] of init.headers) headers[k] = v;
		} else if (init?.headers && typeof init.headers === "object") {
			Object.assign(headers, init.headers as Record<string, string>);
		}
		const body = typeof init?.body === "string" ? init.body : undefined;
		calls.push({ url, method: (init?.method ?? "GET").toUpperCase(), headers, body });
		return new Response(JSON.stringify(response.body), {
			status: response.status ?? 200,
			headers: { "content-type": "application/json" },
		});
	};
	return { fetchImpl, calls };
}

describe("PayGatewaySbpFunctionalLinksModule.create", () => {
	test("шлёт POST /sbp/qrc с Data-обёрткой тела", async () => {
		const { fetchImpl, calls } = makeMockFetch({
			body: {
				Data: {
					qrcId: "AS1000670LSS7DN18SJQDNP4B05KLJL2",
					payload: "https://qr.nspk.ru/abc",
					status: "PENDING",
					ttl: 60,
				},
			},
		});
		const pg = new PayGatewayClient({
			token: "test-jwt",
			baseUrl: "https://enter.tochka.com/uapi/pay/v1.0/sites/tochka-site-00",
			fetch: fetchImpl,
		});

		const res = await pg.sbpFunctionalLinks.create({
			qrcType: "DYNAMIC",
			amount: { currency: "RUB", amount: "1.00" },
			paymentToken: {
				tokenizationPurpose: "Подписка на сервис",
				tokenizationServiceDetails: { serviceName: "Pro", serviceId: "svc-1" },
			},
			ttl: 60,
		});

		expect(res.Data.qrcId).toBe("AS1000670LSS7DN18SJQDNP4B05KLJL2");
		expect(res.Data.payload).toContain("qr.nspk.ru");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(
			"https://enter.tochka.com/uapi/pay/v1.0/sites/tochka-site-00/sbp/qrc",
		);
		expect(calls[0]?.method).toBe("POST");
		expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({
			Data: {
				qrcType: "DYNAMIC",
				amount: { currency: "RUB", amount: "1.00" },
				paymentToken: {
					tokenizationPurpose: "Подписка на сервис",
					tokenizationServiceDetails: { serviceName: "Pro", serviceId: "svc-1" },
				},
				ttl: 60,
			},
		});
	});

	test("Signature header не добавляется (путь не в DEFAULT_SIGNED_PATHS)", async () => {
		const { fetchImpl, calls } = makeMockFetch({
			body: { Data: { qrcId: "x", payload: "x", status: "PENDING" } },
		});
		const pg = new PayGatewayClient({
			token: "test-jwt",
			baseUrl: "https://enter.tochka.com/uapi/pay/v1.0/sites/site-1",
			fetch: fetchImpl,
		});
		await pg.sbpFunctionalLinks.create({
			qrcType: "DYNAMIC",
			amount: { currency: "RUB", amount: "1.00" },
			paymentToken: {
				tokenizationPurpose: "Test",
				tokenizationServiceDetails: { serviceName: "n", serviceId: "i" },
			},
		});
		const headers = calls[0]?.headers ?? {};
		expect(headers.Signature ?? headers.signature).toBeUndefined();
		expect(headers.authorization ?? headers.Authorization).toBe("Bearer test-jwt");
	});

	test("работает без privateKey (подпись для этого endpoint не нужна)", async () => {
		const { fetchImpl } = makeMockFetch({
			body: { Data: { qrcId: "x", payload: "x", status: "PENDING" } },
		});
		const pg = new PayGatewayClient({
			token: "test-jwt",
			baseUrl: "https://enter.tochka.com/uapi/pay/v1.0/sites/site-1",
			fetch: fetchImpl,
			// privateKey намеренно опущен — Signature не требуется
		});
		const res = await pg.sbpFunctionalLinks.create({
			qrcType: "STATIC",
			amount: { currency: "RUB", amount: "0" },
			paymentToken: {
				tokenizationPurpose: "Static",
				tokenizationServiceDetails: { serviceName: "n", serviceId: "i" },
			},
		});
		expect(res.Data.qrcId).toBe("x");
	});
});

describe("PayGatewaySbpFunctionalLinksModule.getTokenizationResult", () => {
	test("шлёт GET /sbp/qrc/{qrcId}/tokenization/result", async () => {
		const { fetchImpl, calls } = makeMockFetch({
			body: { Data: { status: "ACCEPTED", token: "5B4kFDCZm4mVQzx2DnPWN6LxIta" } },
		});
		const pg = new PayGatewayClient({
			token: "test-jwt",
			baseUrl: "https://enter.tochka.com/uapi/pay/v1.0/sites/tochka-site-00",
			fetch: fetchImpl,
		});

		const res = await pg.sbpFunctionalLinks.getTokenizationResult(
			"AS1000670LSS7DN18SJQDNP4B05KLJL2",
		);

		expect(res.Data.status).toBe("ACCEPTED");
		expect(res.Data.token).toBe("5B4kFDCZm4mVQzx2DnPWN6LxIta");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.method).toBe("GET");
		expect(calls[0]?.url).toBe(
			"https://enter.tochka.com/uapi/pay/v1.0/sites/tochka-site-00/sbp/qrc/AS1000670LSS7DN18SJQDNP4B05KLJL2/tokenization/result",
		);
		expect(calls[0]?.body).toBeUndefined();
	});

	test("qrcId с спецсимволами URL-кодируется", async () => {
		const { fetchImpl, calls } = makeMockFetch({ body: { Data: { status: "REJECTED" } } });
		const pg = new PayGatewayClient({
			token: "t",
			baseUrl: "https://example.com",
			fetch: fetchImpl,
		});
		await pg.sbpFunctionalLinks.getTokenizationResult("a/b c?d");
		expect(calls[0]?.url).toBe("https://example.com/sbp/qrc/a%2Fb%20c%3Fd/tokenization/result");
	});

	test("REJECTED статус возвращается без token-поля", async () => {
		const { fetchImpl } = makeMockFetch({ body: { Data: { status: "REJECTED" } } });
		const pg = new PayGatewayClient({
			token: "t",
			baseUrl: "https://example.com",
			fetch: fetchImpl,
		});
		const res = await pg.sbpFunctionalLinks.getTokenizationResult("qrc-1");
		expect(res.Data.status).toBe("REJECTED");
		expect(res.Data.token).toBeUndefined();
	});
});
