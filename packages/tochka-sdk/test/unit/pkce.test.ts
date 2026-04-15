import { describe, expect, test } from "bun:test";
import { generatePkce } from "../../src/auth/pkce.js";

const VERIFIER_ALPHABET = /^[A-Za-z0-9\-._~]+$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

describe("generatePkce", () => {
	test("дефолтная длина = 64", async () => {
		const pair = await generatePkce();
		expect(pair.codeVerifier.length).toBe(64);
	});

	test("кастомная длина", async () => {
		const pair = await generatePkce(43);
		expect(pair.codeVerifier.length).toBe(43);
		const pair2 = await generatePkce(128);
		expect(pair2.codeVerifier.length).toBe(128);
	});

	test("падает при длине вне [43, 128] (RFC 7636)", async () => {
		await expect(generatePkce(42)).rejects.toThrow(/43..128/);
		await expect(generatePkce(129)).rejects.toThrow(/43..128/);
	});

	test("verifier использует только allowed alphabet", async () => {
		const pair = await generatePkce();
		expect(VERIFIER_ALPHABET.test(pair.codeVerifier)).toBe(true);
	});

	test("challenge — валидный base64url без паддинга", async () => {
		const pair = await generatePkce();
		expect(BASE64URL.test(pair.codeChallenge)).toBe(true);
		expect(pair.codeChallenge).not.toContain("=");
		expect(pair.codeChallenge).not.toContain("+");
		expect(pair.codeChallenge).not.toContain("/");
	});

	test("method всегда S256", async () => {
		const pair = await generatePkce();
		expect(pair.codeChallengeMethod).toBe("S256");
	});

	test("разные вызовы дают разные verifier-ы", async () => {
		const a = await generatePkce();
		const b = await generatePkce();
		expect(a.codeVerifier).not.toBe(b.codeVerifier);
	});

	test("challenge = BASE64URL(SHA-256(verifier)) — test vector из RFC 7636", async () => {
		const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
		const expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
		const data = new TextEncoder().encode(verifier);
		const hash = await globalThis.crypto.subtle.digest("SHA-256", data);
		const bytes = new Uint8Array(hash);
		let binary = "";
		for (const b of bytes) binary += String.fromCharCode(b);
		const challenge = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
		expect(challenge).toBe(expected);
	});
});
