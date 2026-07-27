import { OAuthClient, type OAuthClientOptions, type TokenResponse } from "./oauth-client.js";
import type { AuthProvider } from "./types.js";

export type {
	AuthorizeUrlParams,
	OAuthClientOptions,
	TokenResponse,
} from "./oauth-client.js";
export {
	DEFAULT_AUTH_SERVER,
	DEFAULT_SCOPES,
	OAuthClient,
	OAuthTokenError,
} from "./oauth-client.js";

/**
 * Сохранённая пара токенов с абсолютной датой протухания. Immutable — хранилища
 * не должны изменять поля уже сохранённых токенов.
 */
export interface OAuthTokens {
	readonly accessToken: string;
	readonly refreshToken?: string;
	readonly tokenType: string;
	/** Unix-timestamp в миллисекундах, когда access-токен станет невалидным. */
	readonly expiresAt: number;
	readonly scope?: string;
	readonly userId?: string;
}

export interface TokenStore {
	get(key: string): Promise<OAuthTokens | null> | OAuthTokens | null;
	set(key: string, tokens: OAuthTokens): Promise<void> | void;
	delete?(key: string): Promise<void> | void;
}

export class InMemoryTokenStore implements TokenStore {
	private readonly map = new Map<string, OAuthTokens>();
	get(key: string): OAuthTokens | null {
		return this.map.get(key) ?? null;
	}
	set(key: string, tokens: OAuthTokens): void {
		this.map.set(key, tokens);
	}
	delete(key: string): void {
		this.map.delete(key);
	}
}

const inflightRefreshes = new WeakMap<TokenStore, Map<string, Promise<OAuthTokens>>>();

/**
 * Провайдер со статическим access-токеном. Используется когда токен получен
 * извне (например, внешний OAuth-flow) и SDK не должен его обновлять.
 */
export class StaticBearerAuth implements AuthProvider {
	constructor(private readonly accessToken: string) {
		if (!accessToken) throw new Error("StaticBearerAuth: accessToken is required");
	}
	getHeaders(): Record<string, string> {
		return { Authorization: `Bearer ${this.accessToken}` };
	}
}

export type OAuthAuthOptions = OAuthClientOptions & {
	/** Хранилище токенов. По умолчанию — в памяти процесса. */
	store?: TokenStore;
	/** Ключ в сторе. По умолчанию — `oauth:${clientId}`. */
	storeKey?: string;
	/**
	 * За сколько миллисекунд до истечения рефрешить access-токен.
	 * По умолчанию — 60 секунд.
	 */
	refreshAheadMs?: number;
} & (
		| {
				/** Режим service-to-service. SDK сам запросит токен через `client_credentials`. */
				mode: "client_credentials";
				scope?: string | readonly string[];
				tokens?: OAuthTokens;
		  }
		| {
				/** Режим authorization_code. Токены берутся из `tokens` или внешнего `store`. */
				mode: "authorization_code";
				tokens?: OAuthTokens & { refreshToken: string };
				scope?: string | readonly string[];
		  }
	);

/**
 * OAuth-провайдер с автоматическим обновлением токена.
 *
 * - `mode: "client_credentials"` — SDK получает токен автоматически.
 * - `mode: "authorization_code"` — SDK обновляет пару из `tokens` или внешнего store.
 * - Иначе — `OAuthAuth` упадёт с понятной ошибкой в конструкторе.
 *
 * Параллельные запросы на обновление дедуплицируются внутри одного процесса.
 * В multi-process deployment refresh одного `storeKey` нужно сериализовать снаружи.
 */
export class OAuthAuth implements AuthProvider {
	private readonly client: OAuthClient;
	private readonly store: TokenStore;
	private readonly storeKey: string;
	private readonly refreshAheadMs: number;
	private readonly scope: string | readonly string[] | undefined;
	private readonly mode: "client_credentials" | "authorization_code";
	private initialTokens: OAuthTokens | null = null;

	constructor(opts: OAuthAuthOptions) {
		if (opts.mode === "authorization_code" && opts.store && !opts.storeKey) {
			throw new Error(
				"OAuthAuth: authorization_code with a shared store requires an explicit storeKey",
			);
		}
		if (opts.mode === "authorization_code" && !opts.store && !opts.tokens) {
			throw new Error("OAuthAuth: authorization_code requires initial tokens or an external store");
		}
		if (
			opts.refreshAheadMs !== undefined &&
			(!Number.isFinite(opts.refreshAheadMs) || opts.refreshAheadMs < 0)
		) {
			throw new Error("OAuthAuth: refreshAheadMs must be finite and non-negative");
		}
		this.client = new OAuthClient(opts);
		this.store = opts.store ?? new InMemoryTokenStore();
		this.storeKey = opts.storeKey ?? `oauth:${opts.clientId}`;
		this.refreshAheadMs = opts.refreshAheadMs ?? 60_000;
		this.scope = opts.scope;
		this.mode = opts.mode;
		if (opts.tokens) {
			validateOAuthTokens(opts.tokens, "OAuthAuth.tokens");
			this.initialTokens = opts.tokens;
		}
	}

	async getHeaders(): Promise<Record<string, string>> {
		const token = await this.getAccessToken();
		return { Authorization: `Bearer ${token}` };
	}

	/** Явно получить актуальный access-токен. Запускает refresh при необходимости. */
	async getAccessToken(): Promise<string> {
		const stored = await this.loadTokens();
		const now = Date.now();
		if (stored && stored.expiresAt - this.refreshAheadMs > now) return stored.accessToken;
		const fresh = await this.refresh(stored, false);
		return fresh.accessToken;
	}

	/** Принудительно обновить токены. */
	async forceRefresh(): Promise<OAuthTokens> {
		const stored = await this.loadTokens();
		return this.refresh(stored, true);
	}

	private async loadTokens(): Promise<OAuthTokens | null> {
		const stored = await this.store.get(this.storeKey);
		if (stored) {
			validateOAuthTokens(stored, `TokenStore[${this.storeKey}]`);
			this.initialTokens = null;
			return stored;
		}
		if (this.initialTokens) {
			const initial = this.initialTokens;
			await this.store.set(this.storeKey, initial);
			this.initialTokens = null;
			return initial;
		}
		return null;
	}

	private async refresh(stored: OAuthTokens | null, force: boolean): Promise<OAuthTokens> {
		let byKey = inflightRefreshes.get(this.store);
		if (!byKey) {
			byKey = new Map();
			inflightRefreshes.set(this.store, byKey);
		}
		const existing = byKey.get(this.storeKey);
		if (existing) return existing;

		const refresh = this.refreshLatest(stored, force).then((tokens) => {
			this.initialTokens = null;
			return tokens;
		});
		byKey.set(this.storeKey, refresh);
		try {
			return await refresh;
		} finally {
			if (byKey.get(this.storeKey) === refresh) byKey.delete(this.storeKey);
		}
	}

	private async refreshLatest(fallback: OAuthTokens | null, force: boolean): Promise<OAuthTokens> {
		const latest = await this.store.get(this.storeKey);
		if (latest) {
			validateOAuthTokens(latest, `TokenStore[${this.storeKey}]`);
			if (!force && latest.expiresAt - this.refreshAheadMs > Date.now()) return latest;
			return this.doRefresh(latest);
		}
		return this.doRefresh(fallback);
	}

	private async doRefresh(stored: OAuthTokens | null): Promise<OAuthTokens> {
		let raw: TokenResponse;
		if (this.mode === "client_credentials") {
			raw = await this.client.clientCredentials(
				this.scope !== undefined ? { scope: this.scope } : {},
			);
		} else {
			if (stored?.refreshToken) {
				raw = await this.client.refresh(stored.refreshToken);
			} else {
				throw new Error(
					"OAuthAuth: authorization_code mode requires a refresh_token in tokens. " +
						"Run the authorize-code flow and pass a fresh token pair via `tokens`.",
				);
			}
		}
		const tokens: OAuthTokens = {
			accessToken: raw.access_token,
			tokenType: raw.token_type,
			expiresAt: Date.now() + raw.expires_in * 1000,
			...(raw.refresh_token !== undefined
				? { refreshToken: raw.refresh_token }
				: this.mode === "authorization_code" && stored?.refreshToken !== undefined
					? { refreshToken: stored.refreshToken }
					: {}),
			...(raw.scope !== undefined
				? { scope: raw.scope }
				: stored?.scope !== undefined
					? { scope: stored.scope }
					: {}),
			...(raw.user_id !== undefined
				? { userId: raw.user_id }
				: stored?.userId !== undefined
					? { userId: stored.userId }
					: {}),
		};
		validateOAuthTokens(tokens, "OAuth token response");
		await this.store.set(this.storeKey, tokens);
		return tokens;
	}
}

function validateOAuthTokens(tokens: OAuthTokens, source: string): void {
	if (
		typeof tokens.accessToken !== "string" ||
		tokens.accessToken.trim() === "" ||
		typeof tokens.tokenType !== "string" ||
		tokens.tokenType.toLowerCase() !== "bearer" ||
		!Number.isFinite(tokens.expiresAt) ||
		(tokens.refreshToken !== undefined && typeof tokens.refreshToken !== "string") ||
		(tokens.scope !== undefined && typeof tokens.scope !== "string") ||
		(tokens.userId !== undefined && typeof tokens.userId !== "string")
	) {
		throw new Error(`${source} contains an invalid OAuth token set`);
	}
}
