/**
 * Низкоуровневая верификация JWT-тела вебхука Точки (RS256). Общая база для
 * вебхуков основного API ({@link ../index.ts}) и Pay Gateway, у которых разный
 * shape payload, но один публичный ключ и алгоритм.
 */

import { type JWTVerifyOptions, errors as joseErrors, jwtVerify } from "jose";
import {
	type KeyResolver,
	type WebhookKeySource,
	createWebhookKeyResolver,
	getDefaultWebhookKeyResolver,
} from "./jwks.js";

/** Причина, по которой верификация не прошла. */
export type WebhookVerificationReason =
	| "signature"
	| "expired"
	| "not_yet_valid"
	| "algorithm"
	| "jwt_format"
	| "key_fetch"
	| "payload_shape"
	| "unknown";

export class WebhookVerificationError extends Error {
	override readonly name = "WebhookVerificationError";
	readonly reason: WebhookVerificationReason;
	constructor(message: string, reason: WebhookVerificationReason, options?: { cause?: unknown }) {
		super(message, options);
		this.reason = reason;
	}
}

export function classifyJoseError(err: unknown): WebhookVerificationReason {
	if (err instanceof joseErrors.JWSSignatureVerificationFailed) return "signature";
	if (err instanceof joseErrors.JWTExpired) return "expired";
	if (err instanceof joseErrors.JWTClaimValidationFailed) return "expired";
	if (err instanceof joseErrors.JOSEAlgNotAllowed) return "algorithm";
	if (err instanceof joseErrors.JWSInvalid || err instanceof joseErrors.JWTInvalid)
		return "jwt_format";
	if (
		err instanceof joseErrors.JWKSNoMatchingKey ||
		err instanceof joseErrors.JWKSMultipleMatchingKeys
	)
		return "key_fetch";
	return "unknown";
}

export interface VerifyWebhookOptions {
	/** Источник ключа. По умолчанию — публичный JWK Точки. */
	keySource?: WebhookKeySource;
	/** Заготовленный резолвер ключа (взаимоисключим с `keySource`). */
	keyResolver?: KeyResolver;
	/** Опции `jose.jwtVerify` — `issuer`, `audience`, `clockTolerance`. */
	jwtOptions?: JWTVerifyOptions;
}

export function resolveKeyResolver(options: VerifyWebhookOptions): KeyResolver {
	return (
		options.keyResolver ??
		(options.keySource
			? createWebhookKeyResolver(options.keySource)
			: getDefaultWebhookKeyResolver())
	);
}

/**
 * Проверить подпись и срок JWT-тела, вернуть сырой payload. Shape-валидация —
 * на стороне вызывающего (разная для основного API и Pay Gateway).
 */
export async function verifyWebhookJwt(
	rawBody: string,
	options: VerifyWebhookOptions = {},
): Promise<Record<string, unknown>> {
	if (!rawBody || typeof rawBody !== "string") {
		throw new WebhookVerificationError("Empty webhook body", "jwt_format");
	}
	const resolver = resolveKeyResolver(options);
	try {
		const { payload } = await jwtVerify(rawBody.trim(), resolver, {
			...(options.jwtOptions ?? {}),
			algorithms: ["RS256"],
		});
		return payload as Record<string, unknown>;
	} catch (err) {
		if (err instanceof WebhookVerificationError) throw err;
		const reason = classifyJoseError(err);
		throw new WebhookVerificationError(
			`Webhook verification failed (${reason}): ${(err as Error).message}`,
			reason,
			{ cause: err },
		);
	}
}
