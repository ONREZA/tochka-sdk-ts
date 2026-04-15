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

	constructor(private readonly opts: OAuthClientOptions) {
		if (!opts.clientId || !opts.clientSecret) {
			throw new Error("OAuthClient: clientId and clientSecret are required");
		}
		this.authServerUrl = (opts.authServerUrl ?? DEFAULT_AUTH_SERVER).replace(/\/+$/, "");
		this.fetchImpl = opts.fetch ?? fetch;
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
		const res = await this.fetchImpl(`${this.authServerUrl}/connect/introspect`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ access_token: accessToken }).toString(),
		});
		if (!res.ok) {
			const body = await safeJson(res);
			throw new OAuthTokenError(res.status, body);
		}
		return res.text();
	}

	private async token(body: Record<string, string>): Promise<TokenResponse> {
		const params = new URLSearchParams({
			...body,
			client_id: this.opts.clientId,
			client_secret: this.opts.clientSecret,
		});
		const res = await this.fetchImpl(`${this.authServerUrl}/connect/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: params.toString(),
		});
		const parsed = await safeJson(res);
		if (!res.ok) throw new OAuthTokenError(res.status, parsed);
		if (
			!parsed ||
			typeof parsed !== "object" ||
			typeof (parsed as { access_token?: unknown }).access_token !== "string"
		) {
			throw new OAuthTokenError(res.status, parsed);
		}
		return parsed as TokenResponse;
	}
}

function normaliseScope(scope: string | readonly string[] | undefined): string | undefined {
	if (!scope) return undefined;
	return Array.isArray(scope) ? scope.join(" ") : (scope as string);
}

async function safeJson(res: Response): Promise<unknown> {
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
