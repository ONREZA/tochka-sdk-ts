import { type CryptoKey, createLocalJWKSet, importJWK, type JWK, type KeyObject } from "jose";

export const TOCHKA_WEBHOOK_JWKS_URL =
	"https://enter.tochka.com/doc/openapi/static/keys/public" as const;

/**
 * Источник публичного ключа для верификации JWT-вебхуков.
 *
 * Точка Банк сегодня отдаёт одиночный JWK. Стандартный `{ keys: [...] }` также
 * поддерживается с выбором ключа по `kid` из JWT header.
 */
export type WebhookKeySource =
	| { url?: string; cacheMaxAgeMs?: number }
	| { key: WebhookVerificationKey }
	| { jwk: JWK };

export type WebhookVerificationKey = CryptoKey | KeyObject | JWK | Uint8Array;

/**
 * Совместим с key-resolver-сигнатурой `jose.jwtVerify`:
 *   `(protectedHeader, token) => Promise<WebhookVerificationKey>`
 *
 * Передаётся напрямую в `jwtVerify` — это позволяет jose выбирать ключ по
 * `kid` из header-а при использовании remote JWKS.
 */
export type KeyResolver = (
	protectedHeader?: { kid?: string; alg?: string },
	token?: unknown,
) => Promise<WebhookVerificationKey>;

const DEFAULT_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const KEY_FETCH_TIMEOUT_MS = 10_000;

export class WebhookKeyFetchError extends Error {
	override readonly name = "WebhookKeyFetchError";
}

export function createWebhookKeyResolver(source: WebhookKeySource = {}): KeyResolver {
	if ("key" in source) {
		const key = source.key;
		return async () => key;
	}
	if ("jwk" in source) {
		let cached: Promise<CryptoKey | Uint8Array> | null = null;
		return () => {
			if (!cached) {
				cached = importJWK(source.jwk, "RS256").catch((cause) => {
					throw new WebhookKeyFetchError("Failed to import webhook public key", { cause });
				});
				cached.catch(() => {
					cached = null;
				});
			}
			return cached;
		};
	}

	const url = source.url ?? TOCHKA_WEBHOOK_JWKS_URL;
	const maxAge = source.cacheMaxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS;
	validateRemoteSource(url, maxAge);

	let cache: { resolver: KeyResolver; expiresAt: number } | undefined;
	let loading: Promise<KeyResolver> | undefined;

	return async (protectedHeader, token) => {
		const now = Date.now();
		if (!cache || cache.expiresAt <= now) {
			loading ??= fetchRemoteJwks(url);
			try {
				cache = { resolver: await loading, expiresAt: Date.now() + maxAge };
			} finally {
				loading = undefined;
			}
		}
		return cache.resolver(protectedHeader, token);
	};
}

function validateRemoteSource(url: string, maxAge: number): void {
	const parsed = new URL(url);
	if (
		(parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
		parsed.username ||
		parsed.password
	) {
		throw new TypeError("Webhook key URL must be an HTTP(S) URL without credentials");
	}
	if (!Number.isFinite(maxAge) || maxAge < 0) {
		throw new TypeError("Webhook key cacheMaxAgeMs must be a finite non-negative number");
	}
}

async function fetchRemoteJwks(url: string): Promise<KeyResolver> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), KEY_FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const body: unknown = await response.json();
		return resolveRemoteKeys(body);
	} catch (cause) {
		if (cause instanceof WebhookKeyFetchError) throw cause;
		throw new WebhookKeyFetchError(`Failed to fetch webhook public key from ${url}`, {
			cause,
		});
	} finally {
		clearTimeout(timeout);
	}
}

async function resolveRemoteKeys(value: unknown): Promise<KeyResolver> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new WebhookKeyFetchError("Webhook key endpoint returned invalid JSON");
	}
	const record = value as Record<string, unknown>;
	if (Array.isArray(record.keys)) {
		if (record.keys.length > 0 && record.keys.every(isJwk)) {
			const resolver = createLocalJWKSet({ keys: record.keys });
			return (protectedHeader, token) =>
				resolver(protectedHeader ?? { alg: "RS256" }, token as never);
		}
		throw new WebhookKeyFetchError("Webhook key endpoint returned an invalid JWKS");
	}
	if (isJwk(record)) {
		const key = await importJWK(record, "RS256");
		return async () => key;
	}
	throw new WebhookKeyFetchError("Webhook key endpoint returned an invalid JWK");
}

function isJwk(value: unknown): value is JWK {
	return (
		!!value &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		typeof (value as Record<string, unknown>).kty === "string"
	);
}

let defaultResolver: KeyResolver | null = null;

/**
 * Module-level singleton с дефолтным JWKS URL. Используется в `verifyWebhook`
 * когда `keySource`/`keyResolver` не переданы, чтобы 100 параллельных вебхуков
 * не запускали 100 fetch-ов.
 */
export function getDefaultWebhookKeyResolver(): KeyResolver {
	if (!defaultResolver) defaultResolver = createWebhookKeyResolver();
	return defaultResolver;
}
