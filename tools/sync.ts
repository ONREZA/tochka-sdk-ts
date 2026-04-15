#!/usr/bin/env bun
import { spawn } from "node:child_process";
/**
 * Полный цикл обновления спецификации для CI:
 *   1. Качает свежий openapi.json (если отличается от локального)
 *   2. Регенерирует src/_generated/*
 *   3. Строит diff путей и сохраняет в `.sync-report.md`
 *   4. Возвращает exit code 0 (изменения есть), 100 (ничего не изменилось) или 1 (ошибка)
 *
 * Артефакты, на которые смотрит sync-openapi workflow:
 *   - `.sync-report.md` — тело PR
 *   - `specs/openapi.json`, `specs/openapi.prev.json`
 *   - `packages/tochka-sdk/src/_generated/*`
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SPEC_URL = process.env.TOCHKA_SPEC_URL ?? "https://enter.tochka.com/doc/openapi/swagger.json";
const SPEC_PATH = resolve(ROOT, "specs", "openapi.json");
const PREV_PATH = resolve(ROOT, "specs", "openapi.prev.json");
const REPORT_PATH = resolve(ROOT, ".sync-report.md");
const NO_CHANGES_EXIT_CODE = 100;

async function sha256(path: string): Promise<string | null> {
	if (!existsSync(path)) return null;
	return createHash("sha256")
		.update(await readFile(path))
		.digest("hex");
}

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
	return new Promise((ok, fail) => {
		const child = spawn(cmd, args, { cwd: ROOT });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (c: Buffer) => {
			stdout += c.toString();
		});
		child.stderr.on("data", (c: Buffer) => {
			stderr += c.toString();
		});
		child.on("error", fail);
		child.on("close", (code) => {
			if (code === 0) ok({ stdout, stderr });
			else fail(new Error(`${cmd} exited with code ${code}: ${stderr}`));
		});
	});
}

async function main() {
	console.log(`→ Fetching ${SPEC_URL}`);
	const res = await fetch(SPEC_URL, {
		headers: { "User-Agent": "onreza/tochka-sdk sync" },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
	const parsed = (await res.json()) as {
		info?: { version?: string };
		paths?: Record<string, unknown>;
	};

	const nextJson = `${JSON.stringify(parsed, null, 2)}\n`;
	const tmpPath = `${SPEC_PATH}.new`;
	await writeFile(tmpPath, nextJson);

	const prevHash = await sha256(SPEC_PATH);
	const nextHash = await sha256(tmpPath);

	if (prevHash === nextHash) {
		console.log("✓ No changes in spec");
		await rm(tmpPath, { force: true });
		process.exit(NO_CHANGES_EXIT_CODE);
	}

	if (existsSync(SPEC_PATH)) await copyFile(SPEC_PATH, PREV_PATH);
	await copyFile(tmpPath, SPEC_PATH);
	await rm(tmpPath, { force: true });

	console.log("→ Regenerating types");
	await run("bun", ["tools/gen.ts"]);

	console.log("→ Building diff");
	const { stdout: diffOut } = await run("bun", ["tools/diff.ts"]);

	const version = parsed.info?.version ?? "unknown";
	const report = [
		"# Sync OpenAPI → SDK",
		"",
		`API version: **${version}**`,
		"",
		diffOut.trim() || "_No path-level changes_",
		"",
		"---",
		"",
		"<!-- sync-openapi-bot -->",
	].join("\n");
	await writeFile(REPORT_PATH, report);
	console.log(`✓ Wrote ${REPORT_PATH}`);
	console.log("✓ Done — sync produced changes");
}

try {
	await main();
} catch (err) {
	console.error(err);
	process.exit(1);
}
