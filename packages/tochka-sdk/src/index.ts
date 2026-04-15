export { TochkaClient } from "./client.js";
export type { AuthInput, TochkaClientOptions } from "./client.js";

export type { AuthProvider } from "./auth/types.js";
export { JwtAuth, SandboxAuth } from "./auth/jwt.js";
export {
	DEFAULT_AUTH_SERVER,
	DEFAULT_SCOPES,
	InMemoryTokenStore,
	OAuthAuth,
	OAuthClient,
	OAuthTokenError,
	StaticBearerAuth,
} from "./auth/oauth.js";
export type {
	AuthorizeUrlParams,
	OAuthAuthOptions,
	OAuthClientOptions,
	OAuthTokens,
	TokenResponse,
	TokenStore,
} from "./auth/oauth.js";
export { generatePkce } from "./auth/pkce.js";
export type { PkcePair } from "./auth/pkce.js";

export * from "./modules/index.js";

export { DEFAULT_RETRY } from "./core/retry.js";
export type { RetryOptions } from "./core/retry.js";

export {
	TOCHKA_API_VERSION,
	TOCHKA_API_TITLE,
	TOCHKA_BASE_URL_PROD,
	TOCHKA_BASE_URL_SANDBOX,
} from "./_generated/meta.js";

/**
 * Re-export сырых типов генерированной схемы.
 * @example
 *   import type { components } from "@onreza/tochka-sdk";
 *   type AccountModel = components["schemas"]["AccountModel"];
 */
export type { components, operations, paths } from "./_generated/schema.js";
