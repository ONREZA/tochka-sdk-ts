import { type JWK, type KeyLike, createRemoteJWKSet, importJWK } from "jose";

export const TOCHKA_WEBHOOK_JWKS_URL =
	"https://enter.tochka.com/doc/openapi/static/keys/public" as const;

/**
 * Источник публичного ключа для верификации JWT-вебхуков.
 *
 * Точка Банк сегодня отдаёт одиночный JWK. Если в будущем перейдёт на массив
 * `{ keys: [...] }` со стандартным kid-matching, SDK автоматически использует
 * `jose.createRemoteJWKSet` — выбор ключа по `kid` из JWT header.
 */
export type WebhookKeySource =
	| { url?: string; cacheMaxAgeMs?: number }
	| { key: KeyLike | Uint8Array }
	| { jwk: JWK };

/**
 * Совместим с key-resolver-сигнатурой `jose.jwtVerify`:
 *   `(protectedHeader, token) => Promise<KeyLike | Uint8Array>`
 *
 * Передаётся напрямую в `jwtVerify` — это позволяет jose выбирать ключ по
 * `kid` из header-а при использовании remote JWKS.
 */
export type KeyResolver = (
	protectedHeader?: { kid?: string; alg?: string },
	token?: unknown,
) => Promise<KeyLike | Uint8Array>;

const DEFAULT_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

export function createWebhookKeyResolver(source: WebhookKeySource = {}): KeyResolver {
	if ("key" in source) {
		const key = source.key;
		return async () => key;
	}
	if ("jwk" in source) {
		let cached: Promise<KeyLike | Uint8Array> | null = null;
		return () => {
			if (!cached) {
				cached = importJWK(source.jwk, "RS256") as Promise<KeyLike | Uint8Array>;
				cached.catch(() => {
					cached = null;
				});
			}
			return cached;
		};
	}

	const url = source.url ?? TOCHKA_WEBHOOK_JWKS_URL;
	const maxAge = source.cacheMaxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS;

	let remoteJwksResolver: ReturnType<typeof createRemoteJWKSet> | null = null;
	let singleKeyCache: { value: Promise<KeyLike | Uint8Array>; expiresAt: number } | null = null;

	return async (protectedHeader, token) => {
		if (remoteJwksResolver) {
			return (await remoteJwksResolver(protectedHeader ?? { alg: "RS256" }, token as never)) as
				| KeyLike
				| Uint8Array;
		}
		const now = Date.now();
		if (singleKeyCache && singleKeyCache.expiresAt > now) return singleKeyCache.value;
		const value = (async () => {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Failed to fetch webhook public key: HTTP ${res.status}`);
			const body = (await res.json()) as JWK | { keys: JWK[] };
			if ("keys" in body && Array.isArray(body.keys)) {
				remoteJwksResolver = createRemoteJWKSet(new URL(url), { cacheMaxAge: maxAge });
				singleKeyCache = null;
				return (await remoteJwksResolver(protectedHeader ?? { alg: "RS256" }, token as never)) as
					| KeyLike
					| Uint8Array;
			}
			return (await importJWK(body as JWK, "RS256")) as KeyLike | Uint8Array;
		})();
		singleKeyCache = { value, expiresAt: now + maxAge };
		value.catch(() => {
			singleKeyCache = null;
		});
		return value;
	};
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
