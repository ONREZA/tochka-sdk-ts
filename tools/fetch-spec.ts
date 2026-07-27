#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { copyFile, rm, writeFile } from "node:fs/promises";
import { fetchOpenApi, openApiFingerprint, readOpenApi, serializeOpenApi } from "./openapi.js";
import { SPEC_TARGETS, type SpecTarget } from "./specs.js";

async function fetchTarget(target: SpecTarget): Promise<void> {
	console.log(`→ Fetching ${target.label}: ${target.url}`);
	const parsed = await fetchOpenApi(target.url);
	const current = existsSync(target.path) ? await readOpenApi(target.path) : null;
	if (current && openApiFingerprint(current) === openApiFingerprint(parsed)) {
		console.log(`✓ ${target.label}: no semantic changes`);
		return;
	}

	const tmpPath = `${target.path}.new`;
	await writeFile(tmpPath, serializeOpenApi(parsed));
	if (existsSync(target.path)) {
		await copyFile(target.path, target.previousPath);
		console.log(`✓ Saved previous ${target.label} spec`);
	}

	await copyFile(tmpPath, target.path);
	await rm(tmpPath, { force: true });

	console.log(`✓ Updated ${target.label} spec (API version: ${parsed.info.version})`);
}

await Promise.all(SPEC_TARGETS.map(fetchTarget));
console.log("→ Run `bun run gen` to regenerate types");
