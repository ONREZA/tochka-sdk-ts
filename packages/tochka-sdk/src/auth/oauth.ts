import { OAuthClient, type OAuthClientOptions, type TokenResponse } from "./oauth-client.js";
import type { AuthProvider } from "./types.js";

export {
	DEFAULT_AUTH_SERVER,
	DEFAULT_SCOPES,
	OAuthClient,
	OAuthTokenError,
} from "./oauth-client.js";
export type {
	AuthorizeUrlParams,
	OAuthClientOptions,
	TokenResponse,
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
				/** Режим authorization_code. Требует начальные tokens c refreshToken. */
				mode: "authorization_code";
				tokens: OAuthTokens & { refreshToken: string };
				scope?: string | readonly string[];
		  }
	);

/**
 * OAuth-провайдер с автоматическим обновлением токена.
 *
 * - `mode: "client_credentials"` — SDK получает токен автоматически.
 * - `mode: "authorization_code"` с `tokens.refreshToken` — SDK обновляет пару.
 * - Иначе — `OAuthAuth` упадёт с понятной ошибкой в конструкторе.
 *
 * Параллельные запросы на обновление дедуплицируются через in-flight promise.
 */
export class OAuthAuth implements AuthProvider {
	private readonly client: OAuthClient;
	private readonly store: TokenStore;
	private readonly storeKey: string;
	private readonly refreshAheadMs: number;
	private readonly scope: string | readonly string[] | undefined;
	private readonly mode: "client_credentials" | "authorization_code";
	private initialTokens: OAuthTokens | null = null;
	private initialPersistPromise: Promise<void> | null = null;
	private inflightRefresh: Promise<OAuthTokens> | null = null;

	constructor(opts: OAuthAuthOptions) {
		this.client = new OAuthClient(opts);
		this.store = opts.store ?? new InMemoryTokenStore();
		this.storeKey = opts.storeKey ?? `oauth:${opts.clientId}`;
		this.refreshAheadMs = opts.refreshAheadMs ?? 60_000;
		this.scope = opts.scope;
		this.mode = opts.mode;
		if (opts.tokens) {
			this.initialTokens = opts.tokens;
			this.initialPersistPromise = Promise.resolve(this.store.set(this.storeKey, opts.tokens))
				.then(() => undefined)
				.finally(() => {
					this.initialPersistPromise = null;
				});
			this.initialPersistPromise.catch(() => {
				/* проглотим — в getAccessToken повторим */
			});
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
		const fresh = await this.refresh(stored);
		return fresh.accessToken;
	}

	/** Принудительно обновить токены. */
	async forceRefresh(): Promise<OAuthTokens> {
		const stored = await this.loadTokens();
		return this.refresh(stored);
	}

	private async loadTokens(): Promise<OAuthTokens | null> {
		if (this.initialPersistPromise) {
			try {
				await this.initialPersistPromise;
			} catch {
				/* если store.set упал — fallback на initialTokens из памяти */
			}
		}
		const stored = await this.store.get(this.storeKey);
		if (stored) return stored;
		if (this.initialTokens) return this.initialTokens;
		return null;
	}

	private async refresh(stored: OAuthTokens | null): Promise<OAuthTokens> {
		if (this.inflightRefresh) return this.inflightRefresh;
		this.inflightRefresh = this.doRefresh(stored)
			.then((tokens) => {
				this.inflightRefresh = null;
				this.initialTokens = null;
				return tokens;
			})
			.catch((err) => {
				this.inflightRefresh = null;
				throw err;
			});
		return this.inflightRefresh;
	}

	private async doRefresh(stored: OAuthTokens | null): Promise<OAuthTokens> {
		let raw: TokenResponse;
		if (stored?.refreshToken) {
			raw = await this.client.refresh(stored.refreshToken);
		} else if (this.mode === "client_credentials") {
			raw = await this.client.clientCredentials(
				this.scope !== undefined ? { scope: this.scope } : {},
			);
		} else {
			throw new Error(
				"OAuthAuth: authorization_code mode requires a refresh_token in tokens. " +
					"Run the authorize-code flow and pass a fresh token pair via `tokens`.",
			);
		}
		const tokens: OAuthTokens = {
			accessToken: raw.access_token,
			tokenType: raw.token_type,
			expiresAt: Date.now() + raw.expires_in * 1000,
			...(raw.refresh_token !== undefined ? { refreshToken: raw.refresh_token } : {}),
			...(raw.scope !== undefined ? { scope: raw.scope } : {}),
			...(raw.user_id !== undefined ? { userId: raw.user_id } : {}),
		};
		await this.store.set(this.storeKey, tokens);
		return tokens;
	}
}
