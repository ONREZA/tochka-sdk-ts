import { describe, expect, test } from "bun:test";
import { createBodySigner } from "../../src/pay-gateway/signature.js";

async function keypair(modulusLength = 2048) {
	const kp = (await globalThis.crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength,
			publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	)) as CryptoKeyPair;
	const privateKeyPem = await toPem(
		"PRIVATE KEY",
		await globalThis.crypto.subtle.exportKey("pkcs8", kp.privateKey),
	);
	return { privateKeyPem, publicKey: kp.publicKey };
}

async function toPem(label: string, buf: ArrayBuffer): Promise<string> {
	const bytes = new Uint8Array(buf);
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	const b64 = btoa(bin);
	const lines = b64.match(/.{1,64}/g) ?? [];
	return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

async function verifySignature(
	publicKey: CryptoKey,
	body: string | Uint8Array,
	signatureBase64: string,
): Promise<boolean> {
	const binary = atob(signatureBase64);
	const sig = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) sig[i] = binary.charCodeAt(i);
	const data = typeof body === "string" ? new TextEncoder().encode(body) : body;
	return globalThis.crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		publicKey,
		sig as BufferSource,
		data as BufferSource,
	);
}

describe("createBodySigner", () => {
	test("подпись верифицируется публичным ключом (round-trip)", async () => {
		const { privateKeyPem, publicKey } = await keypair();
		const signer = await createBodySigner(privateKeyPem);
		const body = JSON.stringify({ amount: "100.00", siteUid: "test" });
		const sig = await signer.sign(body);
		expect(await verifySignature(publicKey, body, sig)).toBe(true);
	});

	test("подпись разная для разных тел", async () => {
		const { privateKeyPem } = await keypair();
		const signer = await createBodySigner(privateKeyPem);
		const a = await signer.sign("body a");
		const b = await signer.sign("body b");
		expect(a).not.toBe(b);
	});

	test("подпись не должна верифицироваться при изменении тела", async () => {
		const { privateKeyPem, publicKey } = await keypair();
		const signer = await createBodySigner(privateKeyPem);
		const sig = await signer.sign("original");
		expect(await verifySignature(publicKey, "tampered", sig)).toBe(false);
	});

	test("PKCS#1 key → Error с понятным сообщением", async () => {
		const pkcs1 = [
			"-----BEGIN RSA PRIVATE KEY-----",
			"MIIEpAIBAAKCAQEAwz...",
			"-----END RSA PRIVATE KEY-----",
		].join("\n");
		await expect(createBodySigner(pkcs1)).rejects.toThrow(/PKCS#1.*PKCS#8/);
	});

	test("не-RSA ключ → Error из validateSigningKey", async () => {
		const ecKey = (await globalThis.crypto.subtle.generateKey(
			{ name: "ECDSA", namedCurve: "P-256" },
			true,
			["sign", "verify"],
		)) as CryptoKeyPair;
		await expect(createBodySigner(ecKey.privateKey)).rejects.toThrow(/expected RSA/);
	});

	test("готовый CryptoKey в качестве input", async () => {
		const { publicKey } = await keypair();
		const kp = (await globalThis.crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		)) as CryptoKeyPair;
		const signer = await createBodySigner(kp.privateKey);
		const sig = await signer.sign("hello");
		expect(await verifySignature(kp.publicKey, "hello", sig)).toBe(true);
		expect(await verifySignature(publicKey, "hello", sig)).toBe(false);
	});

	test("Uint8Array body тоже работает", async () => {
		const { privateKeyPem, publicKey } = await keypair();
		const signer = await createBodySigner(privateKeyPem);
		const body = new Uint8Array([1, 2, 3, 4, 5]);
		const sig = await signer.sign(body);
		expect(await verifySignature(publicKey, body, sig)).toBe(true);
	});

	test("base64 подпись без переносов строк", async () => {
		const { privateKeyPem } = await keypair();
		const signer = await createBodySigner(privateKeyPem);
		const sig = await signer.sign("long body ".repeat(100));
		expect(sig).not.toContain("\n");
		expect(sig).not.toContain("\r");
	});
});
