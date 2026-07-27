#!/usr/bin/env bun
import { spawn } from "node:child_process";
/**
 * Полный цикл обновления спецификаций для CI:
 *   1. Качает свежие OpenAPI-документы (если отличаются от локальных)
 *   2. Регенерирует src/_generated/*
 *   3. Строит diff путей и сохраняет в `.sync-report.md`
 *   4. Возвращает exit code 0 (изменения есть), 100 (ничего не изменилось) или 1 (ошибка)
 *
 * Артефакты, на которые смотрит sync-openapi workflow:
 *   - `.sync-report.md` — тело PR
 *   - `specs/*.json`, `specs/*.prev.json`
 *   - `packages/tochka-sdk/src/_generated/*`
 */
import { existsSync } from "node:fs";
import { copyFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildOpenApiDiff } from "./diff.js";
import type { OpenApiDocument } from "./openapi.js";
import { fetchOpenApi, openApiFingerprint, readOpenApi, serializeOpenApi } from "./openapi.js";
import { SPEC_TARGETS } from "./specs.js";

const ROOT = resolve(import.meta.dir, "..");
const REPORT_PATH = resolve(ROOT, ".sync-report.md");
const NO_CHANGES_EXIT_CODE = 100;

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
	const fetched = await Promise.all(
		SPEC_TARGETS.map(async (target) => {
			console.log(`→ Fetching ${target.label}: ${target.url}`);
			const [next, current] = await Promise.all([
				fetchOpenApi(target.url),
				existsSync(target.path) ? readOpenApi(target.path) : Promise.resolve(null),
			]);
			return { target, next, current };
		}),
	);
	const changed = fetched.filter(
		(item) => !item.current || openApiFingerprint(item.current) !== openApiFingerprint(item.next),
	);
	if (changed.length === 0) {
		console.log("✓ No changes in specs");
		process.exit(NO_CHANGES_EXIT_CODE);
	}

	for (const { target, next, current } of changed) {
		const tmpPath = `${target.path}.new`;
		await writeFile(tmpPath, serializeOpenApi(next));
		if (current) await copyFile(target.path, target.previousPath);
		await copyFile(tmpPath, target.path);
		await rm(tmpPath, { force: true });
	}

	console.log("→ Regenerating types");
	await run("bun", ["tools/gen.ts"]);

	console.log("→ Building diff");
	const report = [
		"# Sync OpenAPI → SDK",
		"",
		...changed.flatMap(({ target, next, current }) => [
			`## ${target.label}`,
			"",
			current
				? buildOpenApiDiff(
						next as OpenApiDocument & Record<string, unknown>,
						current as OpenApiDocument & Record<string, unknown>,
					).trim()
				: `Initial spec import: **${next.info.version}**`,
			"",
		]),
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
