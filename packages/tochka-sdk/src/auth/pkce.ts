/**
 * PKCE (Proof Key for Code Exchange, RFC 7636).
 *
 * Работает кроссрантаймно через `globalThis.crypto.subtle` — Node 18+, Bun, Deno,
 * Cloudflare Workers.
 */

const VERIFIER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export interface PkcePair {
	codeVerifier: string;
	codeChallenge: string;
	codeChallengeMethod: "S256";
}

/** Сгенерировать пару `code_verifier` / `code_challenge` (S256). */
export async function generatePkce(length = 64): Promise<PkcePair> {
	if (length < 43 || length > 128) {
		throw new Error(`PKCE verifier length must be 43..128, got ${length}`);
	}
	const verifier = randomString(length);
	const challenge = await sha256Base64Url(verifier);
	return { codeVerifier: verifier, codeChallenge: challenge, codeChallengeMethod: "S256" };
}

function randomString(length: number): string {
	const bytes = new Uint8Array(length);
	globalThis.crypto.getRandomValues(bytes);
	let out = "";
	for (let i = 0; i < length; i++) {
		const idx = (bytes[i] as number) % VERIFIER_ALPHABET.length;
		out += VERIFIER_ALPHABET[idx];
	}
	return out;
}

async function sha256Base64Url(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hash = await globalThis.crypto.subtle.digest("SHA-256", data);
	return base64Url(new Uint8Array(hash));
}

function base64Url(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
	const b64 = btoa(binary);
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
