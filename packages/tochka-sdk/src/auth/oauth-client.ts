/**
 * Низкоуровневый клиент OAuth-сервера Точки.
 *
 * @see docs/tochka/scraped-tochka-api/algoritm-raboty-po-oauth-2.0.md
 */

export const DEFAULT_AUTH_SERVER = "https://enter.tochka.com";

export const DEFAULT_SCOPES = [
	"accounts",
	"balances",
	"customers",
	"statements",
	"sbp",
	"payments",
	"acquiring",
] as const;

export interface OAuthClientOptions {
	clientId: string;
	clientSecret: string;
	/** По умолчанию — прод `https://enter.tochka.com`. */
	authServerUrl?: string;
	fetch?: typeof fetch;
	/** Таймаут каждого OAuth HTTP-запроса. `0` отключает таймаут. */
	timeoutMs?: number;
}

export interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	scope?: string;
	state?: string | null;
	user_id?: string;
}

export interface AuthorizeUrlParams {
	scope?: string | readonly string[];
	redirectUri: string;
	consentId: string;
	state: string;
	responseType?: "code";
	codeChallenge?: string;
	codeChallengeMethod?: "S256" | "plain";
}

/**
 * Ошибка OAuth-запроса. Поле `body` содержит ответ сервера для диагностики;
 * помечено non-enumerable, чтобы не всплывать в `JSON.stringify(err)` и логах.
 */
export class OAuthTokenError extends Error {
	override readonly name = "OAuthTokenError";
	readonly status: number;
	readonly body: unknown;
	constructor(status: number, body: unknown) {
		super(buildOAuthErrorMessage(status, body));
		this.status = status;
		Object.defineProperty(this, "body", { value: body, enumerable: false });
	}
}

function buildOAuthErrorMessage(status: number, body: unknown): string {
	if (typeof body !== "object" || body === null) {
		return `OAuth token request failed: HTTP ${status}`;
	}
	const b = body as { error?: unknown; error_description?: unknown };
	if (typeof b.error !== "string") return `OAuth ${status}`;
	return typeof b.error_description === "string"
		? `OAuth ${status}: ${b.error} — ${b.error_description}`
		: `OAuth ${status}: ${b.error}`;
}

export class OAuthClient {
	private readonly authServerUrl: string;
	private readonly fetchImpl: typeof fetch;
	private readonly timeoutMs: number | undefined;

	constructor(private readonly opts: OAuthClientOptions) {
		if (!opts.clientId || !opts.clientSecret) {
			throw new Error("OAuthClient: clientId and clientSecret are required");
		}
		const authServerUrl = new URL(opts.authServerUrl ?? DEFAULT_AUTH_SERVER);
		if (!["http:", "https:"].includes(authServerUrl.protocol)) {
			throw new Error("OAuthClient: authServerUrl must use http or https");
		}
		if (
			authServerUrl.username ||
			authServerUrl.password ||
			authServerUrl.search ||
			authServerUrl.hash
		) {
			throw new Error(
				"OAuthClient: authServerUrl must not contain credentials, query, or fragment",
			);
		}
		if (opts.timeoutMs !== undefined && (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 0)) {
			throw new Error("OAuthClient: timeoutMs must be finite and non-negative");
		}
		this.authServerUrl = authServerUrl.toString().replace(/\/+$/, "");
		this.fetchImpl = opts.fetch ?? fetch;
		this.timeoutMs = opts.timeoutMs;
	}

	/** Получить технический токен для создания consent-ов. */
	clientCredentials(
		opts: { scope?: string | readonly string[] | undefined } = {},
	): Promise<TokenResponse> {
		const body: Record<string, string> = { grant_type: "client_credentials" };
		const scope = normaliseScope(opts.scope);
		if (scope) body.scope = scope;
		return this.token(body);
	}

	/** Обменять `code` от authorize на access+refresh-пару. */
	exchangeCode(opts: {
		code: string;
		redirectUri: string;
		scope?: string | readonly string[];
		codeVerifier?: string;
	}): Promise<TokenResponse> {
		const body: Record<string, string> = {
			grant_type: "authorization_code",
			code: opts.code,
			redirect_uri: opts.redirectUri,
		};
		const scope = normaliseScope(opts.scope);
		if (scope) body.scope = scope;
		if (opts.codeVerifier) body.code_verifier = opts.codeVerifier;
		return this.token(body);
	}

	/** Обновить пару access/refresh по `refresh_token`. */
	refresh(refreshToken: string): Promise<TokenResponse> {
		return this.token({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		});
	}

	/** Построить URL `/connect/authorize` для перенаправления пользователя. */
	buildAuthorizeUrl(params: AuthorizeUrlParams): string {
		const query = new URLSearchParams({
			client_id: this.opts.clientId,
			response_type: params.responseType ?? "code",
			state: params.state,
			redirect_uri: params.redirectUri,
			consent_id: params.consentId,
		});
		const scope = normaliseScope(params.scope);
		if (scope) query.set("scope", scope);
		if (params.codeChallenge) {
			query.set("code_challenge", params.codeChallenge);
			query.set("code_challenge_method", params.codeChallengeMethod ?? "S256");
		}
		return `${this.authServerUrl}/connect/authorize?${query.toString()}`;
	}

	/**
	 * Проверить access token через `/connect/introspect`. Возвращает JWT-строку
	 * (hybrid access token); для декодирования используйте `jose.decodeJwt`.
	 */
	async introspect(accessToken: string): Promise<string> {
		const { response, text } = await this.request("/connect/introspect", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ access_token: accessToken }).toString(),
		});
		if (!response.ok) {
			throw new OAuthTokenError(response.status, safeJson(text));
		}
		return text;
	}

	private async token(body: Record<string, string>): Promise<TokenResponse> {
		const params = new URLSearchParams({
			...body,
			client_id: this.opts.clientId,
			client_secret: this.opts.clientSecret,
		});
		const { response, text } = await this.request("/connect/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: params.toString(),
		});
		const parsed = safeJson(text);
		if (!response.ok) throw new OAuthTokenError(response.status, parsed);
		const token = parsed as Partial<TokenResponse> | null;
		if (
			!token ||
			typeof token !== "object" ||
			typeof token.access_token !== "string" ||
			token.access_token.trim() === "" ||
			typeof token.token_type !== "string" ||
			token.token_type.toLowerCase() !== "bearer" ||
			typeof token.expires_in !== "number" ||
			!Number.isFinite(token.expires_in) ||
			token.expires_in < 0 ||
			!isOptionalString(token.refresh_token) ||
			!isOptionalString(token.scope) ||
			!isOptionalString(token.user_id) ||
			!(token.state === undefined || token.state === null || typeof token.state === "string")
		) {
			throw new OAuthTokenError(response.status, parsed);
		}
		return token as TokenResponse;
	}

	private async request(
		path: string,
		init: RequestInit,
	): Promise<{ response: Response; text: string }> {
		const controller = this.timeoutMs ? new AbortController() : undefined;
		const timer = controller
			? setTimeout(
					() => controller.abort(new Error(`OAuth request timed out after ${this.timeoutMs}ms`)),
					this.timeoutMs,
				)
			: undefined;
		try {
			const response = await this.fetchImpl(`${this.authServerUrl}${path}`, {
				...init,
				...(controller ? { signal: controller.signal } : {}),
			});
			return { response, text: await response.text() };
		} finally {
			if (timer !== undefined) clearTimeout(timer);
		}
	}
}

function isOptionalString(value: unknown): value is string | undefined {
	return value === undefined || typeof value === "string";
}

function normaliseScope(scope: string | readonly string[] | undefined): string | undefined {
	if (!scope) return undefined;
	return Array.isArray(scope) ? scope.join(" ") : (scope as string);
}

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
