#!/usr/bin/env bun
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PACKAGE_ROOT = resolve(import.meta.dir, "..", "packages", "tochka-sdk");
const tempRoot = await mkdtemp(join(tmpdir(), "tochka-sdk-package-"));

try {
	const proc = Bun.spawn(["npm", "pack", "--silent", "--json", "--pack-destination", tempRoot], {
		cwd: PACKAGE_ROOT,
		stdout: "pipe",
		stderr: "inherit",
	});
	const output = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	if (exitCode !== 0) throw new Error(`npm pack failed with exit code ${exitCode}`);

	type PackResult = Array<{
		filename?: string;
		files?: Array<{ path: string }>;
	}>;
	let result: PackResult | undefined;
	for (
		let start = output.lastIndexOf("[");
		start >= 0;
		start = output.lastIndexOf("[", start - 1)
	) {
		try {
			const candidate = JSON.parse(output.slice(start)) as PackResult;
			if (Array.isArray(candidate) && candidate[0]?.filename) {
				result = candidate;
				break;
			}
		} catch {}
	}
	if (!result) throw new Error("Unable to parse npm pack metadata");
	const packed = result[0];
	const files = new Set(packed?.files?.map((file) => file.path) ?? []);
	const required = [
		"README.md",
		"LICENSE",
		"dist/index.js",
		"dist/index.cjs",
		"dist/index.d.ts",
		"dist/index.d.cts",
		"dist/webhooks.js",
		"dist/webhooks.cjs",
		"dist/webhooks.d.ts",
		"dist/webhooks.d.cts",
		"dist/pay-gateway.js",
		"dist/pay-gateway.cjs",
		"dist/pay-gateway.d.ts",
		"dist/pay-gateway.d.cts",
		"dist/errors.js",
		"dist/errors.cjs",
		"dist/errors.d.ts",
		"dist/errors.d.cts",
	];
	const missing = required.filter((file) => !files.has(file));
	if (missing.length > 0) {
		throw new Error(`Package is missing required files: ${missing.join(", ")}`);
	}
	if (!packed?.filename) throw new Error("npm pack did not return a tarball filename");

	const consumerRoot = join(tempRoot, "consumer");
	await mkdir(consumerRoot);
	await Bun.write(join(consumerRoot, "package.json"), '{"private":true}\n');
	const install = Bun.spawn(
		[
			"npm",
			"install",
			"--ignore-scripts",
			"--no-package-lock",
			"--no-audit",
			"--no-fund",
			join(tempRoot, packed.filename),
		],
		{ cwd: consumerRoot, stdout: "inherit", stderr: "inherit" },
	);
	if ((await install.exited) !== 0) throw new Error("Fresh package installation failed");

	const smoke = [
		["@onreza/tochka-sdk", "TochkaClient"],
		["@onreza/tochka-sdk/webhooks", "verifyWebhook"],
		["@onreza/tochka-sdk/pay-gateway", "PayGatewayClient"],
		["@onreza/tochka-sdk/errors", "TochkaError"],
	] as const;
	const script = `
		const checks = ${JSON.stringify(smoke)};
		Promise.all(checks.map(async ([name, symbol]) => {
			const esm = await import(name);
			if (typeof esm[symbol] !== "function") throw new Error(\`Missing ESM export \${name}.\${symbol}\`);
			const cjs = require(name);
			if (typeof cjs[symbol] !== "function") throw new Error(\`Missing CJS export \${name}.\${symbol}\`);
		})).catch((error) => { console.error(error); process.exit(1); });
	`;
	const smokeProcess = Bun.spawn(["node", "-e", script], {
		cwd: consumerRoot,
		stdout: "inherit",
		stderr: "inherit",
	});
	if ((await smokeProcess.exited) !== 0) throw new Error("Packed import smoke test failed");

	console.log(
		`✓ Package contains ${files.size} files; fresh ESM/CJS imports passed for all exports`,
	);
} finally {
	await rm(tempRoot, { recursive: true, force: true });
}
