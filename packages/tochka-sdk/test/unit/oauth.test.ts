import { describe, expect, test } from "bun:test";
import { InMemoryTokenStore, OAuthAuth, type OAuthTokens } from "../../src/auth/oauth.js";

function stubFetch(
	handler: () => Response | Promise<Response>,
	counter = { n: 0 },
): { fetch: typeof fetch; counter: { n: number } } {
	const f = (async () => {
		counter.n += 1;
		return handler();
	}) as typeof fetch;
	return { fetch: f, counter };
}

function tokenResponse(overrides: Record<string, unknown> = {}): Response {
	return new Response(
		JSON.stringify({
			access_token: "at-new",
			token_type: "bearer",
			expires_in: 3600,
			...overrides,
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

describe("OAuthAuth — client_credentials", () => {
	test("первый вызов getAccessToken делает запрос", async () => {
		const counter = { n: 0 };
		const { fetch } = stubFetch(() => tokenResponse(), counter);
		const auth = new OAuthAuth({
			clientId: "cid",
			clientSecret: "sec",
			mode: "client_credentials",
			fetch,
		});
		const t = await auth.getAccessToken();
		expect(t).toBe("at-new");
		expect(counter.n).toBe(1);
	});

	test("повторный вызов использует кэш (не делает сетевой запрос)", async () => {
		const counter = { n: 0 };
		const { fetch } = stubFetch(() => tokenResponse(), counter);
		const auth = new OAuthAuth({
			clientId: "cid",
			clientSecret: "sec",
			mode: "client_credentials",
			fetch,
		});
		await auth.getAccessToken();
		await auth.getAccessToken();
		await auth.getAccessToken();
		expect(counter.n).toBe(1);
	});

	test("параллельные getAccessToken дедуплицируются в один fetch", async () => {
		const counter = { n: 0 };
		const { fetch } = stubFetch(
			async () =>
				new Response(
					JSON.stringify({ access_token: "at-par", token_type: "bearer", expires_in: 3600 }),
					{ status: 200 },
				),
			counter,
		);
		const auth = new OAuthAuth({
			clientId: "cid",
			clientSecret: "sec",
			mode: "client_credentials",
			fetch,
		});
		const results = await Promise.all([
			auth.getAccessToken(),
			auth.getAccessToken(),
			auth.getAccessToken(),
			auth.getAccessToken(),
		]);
		expect(new Set(results).size).toBe(1);
		expect(results[0]).toBe("at-par");
		expect(counter.n).toBe(1);
	});

	test("после истечения токен обновляется", async () => {
		let n = 0;
		const fetch = (async () => {
			n += 1;
			return tokenResponse({ access_token: `at-${n}`, expires_in: 0.05 });
		}) as typeof fetch;
		const auth = new OAuthAuth({
			clientId: "cid",
			clientSecret: "sec",
			mode: "client_credentials",
			refreshAheadMs: 0,
			fetch,
		});
		expect(await auth.getAccessToken()).toBe("at-1");
		await new Promise((r) => setTimeout(r, 70));
		expect(await auth.getAccessToken()).toBe("at-2");
	});

	test("после ошибки refresh inflight сбрасывается — следующий вызов пробует снова", async () => {
		let n = 0;
		const fetch = (async () => {
			n += 1;
			if (n === 1) return new Response("{}", { status: 500 });
			return tokenResponse({ access_token: "at-recovered" });
		}) as typeof fetch;
		const auth = new OAuthAuth({
			clientId: "cid",
			clientSecret: "sec",
			mode: "client_credentials",
			fetch,
		});
		await expect(auth.getAccessToken()).rejects.toThrow();
		expect(await auth.getAccessToken()).toBe("at-recovered");
	});

	test("getHeaders возвращает Bearer token", async () => {
		const { fetch } = stubFetch(() => tokenResponse({ access_token: "xyz" }));
		const auth = new OAuthAuth({
			clientId: "cid",
			clientSecret: "sec",
			mode: "client_credentials",
			fetch,
		});
		const h = await auth.getHeaders();
		expect(h.Authorization).toBe("Bearer xyz");
	});
});

describe("OAuthAuth — authorization_code", () => {
	test("использует refresh_token из начальных tokens", async () => {
		let body = "";
		const fetch = (async (_url: unknown, init: RequestInit) => {
			body = String(init.body);
			return tokenResponse({ access_token: "at-refreshed", refresh_token: "rt-new" });
		}) as typeof fetch;

		const initialTokens: OAuthTokens & { refreshToken: string } = {
			accessToken: "old-at",
			refreshToken: "old-rt",
			tokenType: "bearer",
			expiresAt: Date.now() - 1, // уже истёк
		};

		const auth = new OAuthAuth({
			clientId: "cid",
			clientSecret: "sec",
			mode: "authorization_code",
			tokens: initialTokens,
			fetch,
		});
		const t = await auth.getAccessToken();
		expect(t).toBe("at-refreshed");
		expect(body).toContain("grant_type=refresh_token");
		expect(body).toContain("refresh_token=old-rt");
	});

	test("живой токен из store не триггерит refresh", async () => {
		const counter = { n: 0 };
		const { fetch } = stubFetch(() => tokenResponse(), counter);
		const auth = new OAuthAuth({
			clientId: "cid",
			clientSecret: "sec",
			mode: "authorization_code",
			tokens: {
				accessToken: "still-good",
				refreshToken: "rt",
				tokenType: "bearer",
				expiresAt: Date.now() + 120_000,
			},
			fetch,
		});
		const t = await auth.getAccessToken();
		expect(t).toBe("still-good");
		expect(counter.n).toBe(0);
	});
});

describe("OAuthAuth — TokenStore", () => {
	test("токены сохраняются в переданный store", async () => {
		const store = new InMemoryTokenStore();
		const { fetch } = stubFetch(() => tokenResponse({ access_token: "stored" }));
		const auth = new OAuthAuth({
			clientId: "cid",
			clientSecret: "sec",
			mode: "client_credentials",
			fetch,
			store,
		});
		await auth.getAccessToken();
		const saved = store.get("oauth:cid");
		expect(saved).not.toBe(null);
		expect(saved?.accessToken).toBe("stored");
	});

	test("storeKey кастомизируется", async () => {
		const store = new InMemoryTokenStore();
		const { fetch } = stubFetch(() => tokenResponse());
		const auth = new OAuthAuth({
			clientId: "cid",
			clientSecret: "sec",
			mode: "client_credentials",
			fetch,
			store,
			storeKey: "custom-key",
		});
		await auth.getAccessToken();
		expect(store.get("custom-key")).not.toBe(null);
		expect(store.get("oauth:cid")).toBe(null);
	});
});
