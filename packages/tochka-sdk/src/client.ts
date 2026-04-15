import {
	TOCHKA_API_VERSION,
	TOCHKA_BASE_URL_PROD,
	TOCHKA_BASE_URL_SANDBOX,
} from "./_generated/meta.js";
import { JwtAuth, SandboxAuth } from "./auth/jwt.js";
import { OAuthAuth, type OAuthAuthOptions, StaticBearerAuth } from "./auth/oauth.js";
import type { AuthProvider } from "./auth/types.js";
import {
	DEFAULT_RETRY,
	type RetryOptions,
	type TochkaFetchClient,
	buildFetchClient,
	makeRetryingFetch,
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
	onResponse?: (info: {
		method: string;
		url: string;
		status: number;
		durationMs: number;
	}) => void;
}

const AUTH_KEYS = ["jwt", "sandbox", "bearer", "oauth", "custom"] as const;

function resolveAuth(input: AuthInput): { provider: AuthProvider; isSandbox: boolean } {
	const present = AUTH_KEYS.filter((k) => k in (input as Record<string, unknown>));
	if (present.length !== 1) {
		throw new Error(
			`TochkaClient.auth: exactly one of [${AUTH_KEYS.join(", ")}] must be set, got [${present.join(", ")}]`,
		);
	}
	if ("jwt" in input) return { provider: new JwtAuth(input.jwt), isSandbox: false };
	if ("sandbox" in input) return { provider: new SandboxAuth(), isSandbox: true };
	if ("bearer" in input) return { provider: new StaticBearerAuth(input.bearer), isSandbox: false };
	if ("oauth" in input) return { provider: new OAuthAuth(input.oauth), isSandbox: false };
	if ("custom" in input) return { provider: input.custom, isSandbox: false };
	throw new Error("TochkaClient: unknown auth input");
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

	constructor(
		options: TochkaClientOptions,
		_internal?: { provider?: AuthProvider; isSandbox?: boolean },
	) {
		this.options = options;
		if (_internal?.provider) {
			this.provider = _internal.provider;
			this.isSandbox = _internal.isSandbox ?? false;
		} else {
			const resolved = resolveAuth(options.auth);
			this.provider = resolved.provider;
			this.isSandbox = resolved.isSandbox;
		}
		const baseUrl =
			options.baseUrl ?? (this.isSandbox ? TOCHKA_BASE_URL_SANDBOX : TOCHKA_BASE_URL_PROD);

		const baseFetch = options.fetch ?? fetch;
		const effectiveFetch =
			options.retry === false
				? baseFetch
				: makeRetryingFetch({ ...DEFAULT_RETRY, ...(options.retry ?? {}) }, baseFetch);

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
		return new TochkaClient(
			{ ...this.options, customerCode },
			{ provider: this.provider, isSandbox: this.isSandbox },
		);
	}
}
