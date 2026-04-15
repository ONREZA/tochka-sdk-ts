#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SPEC_URL = process.env.TOCHKA_SPEC_URL ?? "https://enter.tochka.com/doc/openapi/swagger.json";
const SPEC_PATH = resolve(import.meta.dir, "..", "specs", "openapi.json");
const PREV_PATH = resolve(import.meta.dir, "..", "specs", "openapi.prev.json");

async function sha256(path: string): Promise<string | null> {
	if (!existsSync(path)) return null;
	const data = await readFile(path);
	return createHash("sha256").update(data).digest("hex");
}

async function main() {
	console.log(`→ Fetching ${SPEC_URL}`);
	const res = await fetch(SPEC_URL, {
		headers: { "User-Agent": "onreza/tochka-sdk fetch-spec" },
	});
	if (!res.ok) {
		console.error(`✗ Failed: HTTP ${res.status} ${res.statusText}`);
		process.exit(1);
	}

	const remoteText = await res.text();
	let parsed: unknown;
	try {
		parsed = JSON.parse(remoteText);
	} catch (err) {
		console.error("✗ Remote response is not valid JSON");
		throw err;
	}

	const remoteJson = `${JSON.stringify(parsed, null, 2)}\n`;
	const tmpPath = `${SPEC_PATH}.new`;
	await writeFile(tmpPath, remoteJson);

	const currentHash = await sha256(SPEC_PATH);
	const newHash = await sha256(tmpPath);

	if (currentHash === newHash) {
		console.log("✓ No changes (sha256 match)");
		await Bun.file(tmpPath)
			.delete?.()
			.catch(() => {});
		process.exit(0);
	}

	if (existsSync(SPEC_PATH)) {
		await copyFile(SPEC_PATH, PREV_PATH);
		console.log("✓ Saved previous spec to specs/openapi.prev.json");
	}

	await copyFile(tmpPath, SPEC_PATH);
	await Bun.file(tmpPath)
		.delete?.()
		.catch(() => {});

	const version = (parsed as { info?: { version?: string } }).info?.version ?? "unknown";
	console.log(`✓ Updated specs/openapi.json (API version: ${version})`);
	console.log("→ Run `bun run gen` to regenerate types");
}

await main();
