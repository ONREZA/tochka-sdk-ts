#!/usr/bin/env bun
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const FILES = [
	"packages/tochka-sdk/src/_generated/schema.d.ts",
	"packages/tochka-sdk/src/_generated/pay-gateway.d.ts",
	"packages/tochka-sdk/src/_generated/meta.ts",
] as const;

const readGenerated = () => Promise.all(FILES.map((file) => Bun.file(resolve(ROOT, file)).text()));

const before = await readGenerated();
const generation = Bun.spawn(["bun", "tools/gen.ts"], {
	cwd: ROOT,
	stdout: "inherit",
	stderr: "inherit",
});
if ((await generation.exited) !== 0) process.exit(1);

const after = await readGenerated();
const changed = FILES.filter((_, index) => before[index] !== after[index]);
if (changed.length > 0) {
	console.error(`Generated files were stale: ${changed.join(", ")}`);
	process.exit(1);
}

console.log("✓ Generated files match both OpenAPI specifications");
