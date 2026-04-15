import { importPKCS8 } from "jose";

/**
 * Подпись тела запроса RSA-SHA256 для Pay Gateway.
 *
 * Требования (docs/tochka/scraped/request-signature-and-authorization.md):
 *   - Алгоритм: RSA 2048-bit
 *   - Хэш: SHA-256
 *   - Заголовок: `Signature`
 *   - Формат: «сырая» подпись, Base64 в одну строку
 *
 * Ключ должен быть в формате PKCS#8 PEM (начинается с `-----BEGIN PRIVATE KEY-----`).
 * Если у вас PKCS#1 (`BEGIN RSA PRIVATE KEY`), сконвертируйте:
 *   openssl pkcs8 -topk8 -nocrypt -in private.pem -out private_pkcs8.pem
 */

export type PrivateKeyInput = string | CryptoKey;

const MIN_MODULUS_LENGTH = 2048;

async function normaliseKey(input: PrivateKeyInput): Promise<CryptoKey> {
	let key: CryptoKey;
	if (typeof input !== "string") {
		key = input;
	} else {
		const pem = input.trim();
		if (pem.includes("BEGIN RSA PRIVATE KEY")) {
			throw new Error(
				"PayGateway signature: PKCS#1 key detected. Convert to PKCS#8 first: " +
					"`openssl pkcs8 -topk8 -nocrypt -in private.pem -out private_pkcs8.pem`",
			);
		}
		key = (await importPKCS8(pem, "RS256")) as unknown as CryptoKey;
	}
	validateSigningKey(key);
	return key;
}

function validateSigningKey(key: CryptoKey): void {
	const alg = key.algorithm as { name?: string; modulusLength?: number };
	if (alg.name !== "RSASSA-PKCS1-v1_5" && alg.name !== "RSA-PSS") {
		throw new Error(
			`PayGateway signature: expected RSA key, got algorithm "${alg.name ?? "unknown"}"`,
		);
	}
	if (typeof alg.modulusLength === "number" && alg.modulusLength < MIN_MODULUS_LENGTH) {
		throw new Error(
			`PayGateway signature: RSA key is ${alg.modulusLength}-bit, minimum ${MIN_MODULUS_LENGTH} required`,
		);
	}
}

export interface BodySigner {
	sign(body: string | Uint8Array): Promise<string>;
}

export async function createBodySigner(privateKey: PrivateKeyInput): Promise<BodySigner> {
	const key = await normaliseKey(privateKey);
	return {
		async sign(body) {
			const data = typeof body === "string" ? new TextEncoder().encode(body) : body;
			const sig = await globalThis.crypto.subtle.sign(
				"RSASSA-PKCS1-v1_5",
				key,
				data as BufferSource,
			);
			return base64(new Uint8Array(sig));
		},
	};
}

function base64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}
