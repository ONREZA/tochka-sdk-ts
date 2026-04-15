#!/usr/bin/env bun
/** Diff путей и operationId между двумя OpenAPI-снимками. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const SPEC_PATH = resolve(import.meta.dir, "..", "specs", "openapi.json");
const PREV_PATH = resolve(import.meta.dir, "..", "specs", "openapi.prev.json");

type Op = { path: string; method: string; operationId?: string; summary?: string };

function collectOps(spec: { paths?: Record<string, Record<string, unknown>> }): Map<string, Op> {
	const out = new Map<string, Op>();
	const paths = spec.paths ?? {};
	for (const [path, methods] of Object.entries(paths)) {
		for (const [method, op] of Object.entries(methods)) {
			if (!["get", "post", "put", "delete", "patch"].includes(method)) continue;
			const o = op as { operationId?: string; summary?: string };
			const key = `${method.toUpperCase()} ${path}`;
			out.set(key, { path, method, operationId: o.operationId, summary: o.summary });
		}
	}
	return out;
}

async function main() {
	if (!existsSync(PREV_PATH)) {
		console.log("No previous spec — first run? Skipping diff.");
		process.exit(0);
	}
	const [curr, prev] = await Promise.all([
		Bun.file(SPEC_PATH).json() as Promise<Parameters<typeof collectOps>[0]>,
		Bun.file(PREV_PATH).json() as Promise<Parameters<typeof collectOps>[0]>,
	]);

	const currOps = collectOps(curr);
	const prevOps = collectOps(prev);

	const added: Op[] = [];
	const removed: Op[] = [];

	for (const [k, v] of currOps) if (!prevOps.has(k)) added.push(v);
	for (const [k, v] of prevOps) if (!currOps.has(k)) removed.push(v);

	const info = (curr as unknown as { info?: { version?: string } }).info?.version ?? "?";
	const prevInfo = (prev as unknown as { info?: { version?: string } }).info?.version ?? "?";

	console.log(`# API diff: ${prevInfo} → ${info}\n`);

	if (added.length) {
		console.log(`## Добавлено (${added.length})\n`);
		for (const o of added)
			console.log(
				`- \`${o.method.toUpperCase()} ${o.path}\` — ${o.summary ?? o.operationId ?? ""}`,
			);
		console.log("");
	}
	if (removed.length) {
		console.log(`## Удалено (${removed.length}) ⚠️ breaking\n`);
		for (const o of removed)
			console.log(
				`- \`${o.method.toUpperCase()} ${o.path}\` — ${o.summary ?? o.operationId ?? ""}`,
			);
		console.log("");
	}
	if (!added.length && !removed.length) {
		console.log("Изменений на уровне путей нет. Возможно, изменились схемы (TODO).");
	}
}

await main();
