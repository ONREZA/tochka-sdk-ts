import { beforeEach, describe, expect, test } from "bun:test";
import { OAuthClient, OAuthTokenError } from "../../src/auth/oauth-client.js";

function stubFetch(
	handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): typeof fetch {
	return (async (url: RequestInfo | URL, init?: RequestInit) => {
		const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
		return handler(u, init ?? {});
	}) as typeof fetch;
}

describe("OAuthClient.buildAuthorizeUrl", () => {
	const client = new OAuthClient({ clientId: "cid", clientSecret: "sec" });

	test("содержит все обязательные параметры", () => {
		const url = client.buildAuthorizeUrl({
			redirectUri: "http://localhost:3000/cb",
			consentId: "c1",
			state: "st",
		});
		const u = new URL(url);
		expect(u.origin + u.pathname).toBe("https://enter.tochka.com/connect/authorize");
		expect(u.searchParams.get("client_id")).toBe("cid");
		expect(u.searchParams.get("response_type")).toBe("code");
		expect(u.searchParams.get("state")).toBe("st");
		expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:3000/cb");
		expect(u.searchParams.get("consent_id")).toBe("c1");
	});

	test("scope: массив → пробел-разделённая строка", () => {
		const url = client.buildAuthorizeUrl({
			redirectUri: "r",
			consentId: "c",
			state: "s",
			scope: ["accounts", "balances"],
		});
		expect(new URL(url).searchParams.get("scope")).toBe("accounts balances");
	});

	test("scope: строка передаётся как есть", () => {
		const url = client.buildAuthorizeUrl({
			redirectUri: "r",
			consentId: "c",
			state: "s",
			scope: "sbp payments",
		});
		expect(new URL(url).searchParams.get("scope")).toBe("sbp payments");
	});

	test("scope отсутствует если не передан", () => {
		const url = client.buildAuthorizeUrl({ redirectUri: "r", consentId: "c", state: "s" });
		expect(new URL(url).searchParams.has("scope")).toBe(false);
	});

	test("PKCE: code_challenge + method=S256 по умолчанию", () => {
		const url = client.buildAuthorizeUrl({
			redirectUri: "r",
			consentId: "c",
			state: "s",
			codeChallenge: "abc",
		});
		const u = new URL(url);
		expect(u.searchParams.get("code_challenge")).toBe("abc");
		expect(u.searchParams.get("code_challenge_method")).toBe("S256");
	});

	test("PKCE: явный method=plain", () => {
		const url = client.buildAuthorizeUrl({
			redirectUri: "r",
			consentId: "c",
			state: "s",
			codeChallenge: "abc",
			codeChallengeMethod: "plain",
		});
		expect(new URL(url).searchParams.get("code_challenge_method")).toBe("plain");
	});

	test("trailing slash в authServerUrl обрезается", () => {
		const c = new OAuthClient({
			clientId: "x",
			clientSecret: "y",
			authServerUrl: "https://custom.example.com///",
		});
		const url = c.buildAuthorizeUrl({ redirectUri: "r", consentId: "c", state: "s" });
		expect(url).toStartWith("https://custom.example.com/connect/authorize?");
	});
});

describe("OAuthClient.token — валидация ответа", () => {
	test("успешный ответ возвращает TokenResponse", async () => {
		const client = new OAuthClient({
			clientId: "cid",
			clientSecret: "sec",
			fetch: stubFetch(
				async () =>
					new Response(
						JSON.stringify({ access_token: "at", token_type: "bearer", expires_in: 3600 }),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		});
		const t = await client.clientCredentials();
		expect(t.access_token).toBe("at");
		expect(t.expires_in).toBe(3600);
	});

	test("non-2xx с JSON-телом → OAuthTokenError", async () => {
		const client = new OAuthClient({
			clientId: "cid",
			clientSecret: "sec",
			fetch: stubFetch(
				async () =>
					new Response(JSON.stringify({ error: "invalid_client", error_description: "bad" }), {
						status: 401,
					}),
			),
		});
		try {
			await client.clientCredentials();
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(OAuthTokenError);
			expect((err as OAuthTokenError).status).toBe(401);
			expect((err as Error).message).toContain("invalid_client");
			expect((err as Error).message).toContain("bad");
		}
	});

	test("200 с non-JSON телом → OAuthTokenError (не silent bug)", async () => {
		const client = new OAuthClient({
			clientId: "cid",
			clientSecret: "sec",
			fetch: stubFetch(async () => new Response("OK plaintext", { status: 200 })),
		});
		await expect(client.clientCredentials()).rejects.toBeInstanceOf(OAuthTokenError);
	});

	test("200 с JSON без access_token → OAuthTokenError", async () => {
		const client = new OAuthClient({
			clientId: "cid",
			clientSecret: "sec",
			fetch: stubFetch(async () => new Response(JSON.stringify({ foo: "bar" }), { status: 200 })),
		});
		await expect(client.clientCredentials()).rejects.toBeInstanceOf(OAuthTokenError);
	});

	test("OAuthTokenError.body не enumerable (не попадает в JSON.stringify)", () => {
		const err = new OAuthTokenError(401, { error: "x", refresh_token: "secret" });
		const serialized = JSON.stringify(err);
		expect(serialized).not.toContain("secret");
	});
});

describe("OAuthClient конструктор", () => {
	test("падает без clientId/clientSecret", () => {
		expect(() => new OAuthClient({ clientId: "", clientSecret: "y" })).toThrow();
		expect(() => new OAuthClient({ clientId: "x", clientSecret: "" })).toThrow();
	});
});

describe("refresh/exchangeCode отправляют правильные body", () => {
	let lastBody = "";
	let lastUrl = "";
	let client: OAuthClient;

	beforeEach(() => {
		lastBody = "";
		lastUrl = "";
		client = new OAuthClient({
			clientId: "cid",
			clientSecret: "sec",
			fetch: stubFetch(async (url, init) => {
				lastUrl = url;
				lastBody = String(init.body);
				return new Response(
					JSON.stringify({ access_token: "t", token_type: "bearer", expires_in: 100 }),
					{ status: 200 },
				);
			}),
		});
	});

	test("refresh_token grant", async () => {
		await client.refresh("rt123");
		expect(lastUrl).toContain("/connect/token");
		expect(lastBody).toContain("grant_type=refresh_token");
		expect(lastBody).toContain("refresh_token=rt123");
		expect(lastBody).toContain("client_id=cid");
		expect(lastBody).toContain("client_secret=sec");
	});

	test("exchangeCode передаёт code+redirect+verifier", async () => {
		await client.exchangeCode({
			code: "c123",
			redirectUri: "http://localhost:3000/cb",
			codeVerifier: "verif",
			scope: ["accounts"],
		});
		expect(lastBody).toContain("grant_type=authorization_code");
		expect(lastBody).toContain("code=c123");
		expect(lastBody).toContain("code_verifier=verif");
		expect(lastBody).toContain("scope=accounts");
	});

	test("client_credentials без scope — без параметра в body", async () => {
		await client.clientCredentials();
		expect(lastBody).not.toContain("scope=");
		expect(lastBody).toContain("grant_type=client_credentials");
	});
});
