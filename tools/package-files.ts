#!/usr/bin/env bun
import { copyFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const PACKAGE_ROOT = resolve(ROOT, "packages", "tochka-sdk");
const FILES = ["README.md", "LICENSE"] as const;

async function prepare(): Promise<void> {
	await Promise.all(
		FILES.map((file) => copyFile(resolve(ROOT, file), resolve(PACKAGE_ROOT, file))),
	);
}

async function clean(): Promise<void> {
	await Promise.all(FILES.map((file) => rm(resolve(PACKAGE_ROOT, file), { force: true })));
}

const command = process.argv[2];
if (command === "prepare") {
	await prepare();
} else if (command === "clean") {
	await clean();
} else {
	throw new Error("Usage: bun tools/package-files.ts <prepare|clean>");
}
