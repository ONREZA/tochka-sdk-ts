import {
	TOCHKA_API_VERSION,
	TOCHKA_BASE_URL_PROD,
	TOCHKA_BASE_URL_SANDBOX,
} from "./_generated/meta.js";
import { JwtAuth, SandboxAuth } from "./auth/jwt.js";
import { OAuthAuth, type OAuthAuthOptions, StaticBearerAuth } from "./auth/oauth.js";
import type { AuthProvider } from "./auth/types.js";
import {
	buildFetchClient,
	makeRetryingFetch,
	type RetryOptions,
	resolveRetryOptions,
	type TochkaFetchClient,
} from "./core/index.js";
import { AccountsModule } from "./modules/accounts.js";
import { AcquiringModule } from "./modules/acquiring.js";
import { BalancesModule } from "./modules/balances.js";
import { ConsentsModule } from "./modules/consents.js";
import { CustomersModule } from "./modules/customers.js";
import { InvoiceModule } from "./modules/invoice.js";
import { PaymentsModule } from "./modules/payments.js";
import { SbpModule } from "./modules/sbp.js";
import { StatementsModule } from "./modules/statements.js";
import { WebhooksMgmtModule } from "./modules/webhook-mgmt.js";

/**
 * Способ авторизации.
 *
 * - `{ jwt }` — персональный JWT-ключ из интернет-банка (самый простой путь).
 * - `{ sandbox: true }` — песочница (`Bearer sandbox.jwt.token`).
 * - `{ bearer }` — готовый access-токен (например, из внешнего OAuth-flow).
 * - `{ oauth }` — полный OAuth 2.0 flow с авто-рефрешем.
 * - `{ custom }` — произвольный `AuthProvider`.
 *
 * Ровно один из ключей должен быть задан — это проверяется в рантайме.
 */
export type AuthInput =
	| { jwt: string }
	| { sandbox: true }
	| { bearer: string }
	| { oauth: OAuthAuthOptions }
	| { custom: AuthProvider };

export interface TochkaClientOptions {
	auth: AuthInput;
	baseUrl?: string;
	customerCode?: string;
	timeoutMs?: number;
	retry?: Partial<RetryOptions> | false;
	fetch?: typeof fetch;
	headers?: Record<string, string>;
	userAgent?: string;
	onRequest?: (info: { method: string; url: string }) => void;
	onResponse?: (info: { method: string; url: string; status: number; durationMs: number }) => void;
}

const AUTH_KEYS = ["jwt", "sandbox", "bearer", "oauth", "custom"] as const;

function resolveAuth(
	input: AuthInput,
	timeoutMs: number | undefined,
): { provider: AuthProvider; isSandbox: boolean } {
	if (!input || typeof input !== "object") {
		throw new Error("TochkaClient.auth must be an object");
	}
	const present = AUTH_KEYS.filter((key) => Object.hasOwn(input, key));
	if (present.length !== 1) {
		throw new Error(
			`TochkaClient.auth: exactly one of [${AUTH_KEYS.join(", ")}] must be set, got [${present.join(", ")}]`,
		);
	}
	switch (present[0]) {
		case "jwt":
			return { provider: new JwtAuth((input as { jwt: string }).jwt), isSandbox: false };
		case "sandbox":
			if ((input as { sandbox: unknown }).sandbox !== true) {
				throw new Error("TochkaClient.auth.sandbox must be true");
			}
			return { provider: new SandboxAuth(), isSandbox: true };
		case "bearer":
			return {
				provider: new StaticBearerAuth((input as { bearer: string }).bearer),
				isSandbox: false,
			};
		case "oauth": {
			const oauth = (input as { oauth: OAuthAuthOptions }).oauth;
			return {
				provider: new OAuthAuth(
					timeoutMs !== undefined && oauth.timeoutMs === undefined
						? { ...oauth, timeoutMs }
						: oauth,
				),
				isSandbox: false,
			};
		}
		case "custom": {
			const provider = (input as { custom: AuthProvider }).custom;
			if (!provider || typeof provider.getHeaders !== "function") {
				throw new Error("TochkaClient.auth.custom must implement getHeaders()");
			}
			return { provider, isSandbox: false };
		}
	}
	throw new Error("TochkaClient: unknown auth input");
}

function validateClientOptions(options: TochkaClientOptions): void {
	if (
		options.timeoutMs !== undefined &&
		(!Number.isFinite(options.timeoutMs) || options.timeoutMs < 0)
	) {
		throw new Error("TochkaClient.timeoutMs must be finite and non-negative");
	}
	if (options.baseUrl !== undefined) {
		const url = new URL(options.baseUrl);
		if (!["http:", "https:"].includes(url.protocol)) {
			throw new Error("TochkaClient.baseUrl must use http or https");
		}
		if (url.username || url.password || url.search || url.hash) {
			throw new Error("TochkaClient.baseUrl must not contain credentials, query, or fragment");
		}
	}
}

/**
 * Корневой клиент Точки.
 *
 * @example
 *   const client = new TochkaClient({ auth: { jwt: process.env.TOCHKA_JWT! } });
 *   const customers = await client.customers.list();
 *
 * @example sandbox
 *   const client = TochkaClient.sandbox();
 *
 * @example привязка к компании (переиспользует auth-provider)
 *   const company = client.forCustomer("300000092");
 *   const accounts = await company.accounts.list();
 */
export class TochkaClient {
	readonly accounts: AccountsModule;
	readonly acquiring: AcquiringModule;
	readonly balances: BalancesModule;
	readonly consents: ConsentsModule;
	readonly customers: CustomersModule;
	readonly invoice: InvoiceModule;
	readonly payments: PaymentsModule;
	readonly sbp: SbpModule;
	readonly statements: StatementsModule;
	readonly webhooks: WebhooksMgmtModule;

	private readonly options: TochkaClientOptions;
	private readonly provider: AuthProvider;
	private readonly isSandbox: boolean;

	/**
	 * Низкоуровневый `openapi-fetch`-клиент. Помечен `@internal` — публичный
	 * контракт не гарантируем, API зависит от версии `openapi-fetch`.
	 * @internal
	 */
	readonly rawFetch: TochkaFetchClient;

	static readonly apiVersion = TOCHKA_API_VERSION;

	constructor(options: TochkaClientOptions) {
		validateClientOptions(options);
		this.options = options;
		const resolved = resolveAuth(options.auth, options.timeoutMs);
		this.provider = resolved.provider;
		this.isSandbox = resolved.isSandbox;
		const baseUrl =
			options.baseUrl ?? (this.isSandbox ? TOCHKA_BASE_URL_SANDBOX : TOCHKA_BASE_URL_PROD);

		const baseFetch = options.fetch ?? fetch;
		const effectiveFetch =
			options.retry === false
				? baseFetch
				: makeRetryingFetch(resolveRetryOptions(options.retry), baseFetch);

		this.rawFetch = buildFetchClient({
			baseUrl,
			auth: this.provider,
			customerCode: options.customerCode,
			fetch: effectiveFetch,
			headers: options.headers,
			userAgent: options.userAgent,
			timeoutMs: options.timeoutMs,
			onRequest: options.onRequest,
			onResponse: options.onResponse,
		});

		const code = options.customerCode;
		this.accounts = new AccountsModule(this.rawFetch, code);
		this.acquiring = new AcquiringModule(this.rawFetch, code);
		this.balances = new BalancesModule(this.rawFetch, code);
		this.consents = new ConsentsModule(this.rawFetch, code);
		this.customers = new CustomersModule(this.rawFetch, code);
		this.invoice = new InvoiceModule(this.rawFetch, code);
		this.payments = new PaymentsModule(this.rawFetch, code);
		this.sbp = new SbpModule(this.rawFetch, code);
		this.statements = new StatementsModule(this.rawFetch, code);
		this.webhooks = new WebhooksMgmtModule(this.rawFetch, code);
	}

	/** Sandbox-клиент с предустановленным токеном `sandbox.jwt.token`. */
	static sandbox(
		options: Omit<TochkaClientOptions, "auth" | "baseUrl"> & { baseUrl?: string } = {},
	): TochkaClient {
		return new TochkaClient({ ...options, auth: { sandbox: true } });
	}

	/**
	 * Клиент, привязанный к компании. **Переиспользует** текущий `AuthProvider`
	 * (важно для OAuth — токен-кэш и inflight-dedup общие с родителем).
	 */
	forCustomer(customerCode: string): TochkaClient {
		const baseUrl =
			this.options.baseUrl ?? (this.isSandbox ? TOCHKA_BASE_URL_SANDBOX : TOCHKA_BASE_URL_PROD);
		return new TochkaClient({
			...this.options,
			auth: { custom: this.provider },
			baseUrl,
			customerCode,
		});
	}
}
