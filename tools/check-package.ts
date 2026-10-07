#!/usr/bin/env bun
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const PACKAGE_ROOT = resolve(import.meta.dir, "..", "packages", "tochka-sdk");
const tempRoot = await mkdtemp("/var/tmp/tochka-sdk-package-");

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

	const consumerSource = `
import { TochkaClient, type PaymentForSign, type SbpCustomerInfo } from "@onreza/tochka-sdk";
import { verifyWebhook, type TochkaWebhookEvent } from "@onreza/tochka-sdk/webhooks";
import { PayGatewayClient, type PayGatewayOperation, type CreateSbpFunctionalLinkRequest } from "@onreza/tochka-sdk/pay-gateway";
import { TochkaError } from "@onreza/tochka-sdk/errors";

const bank = new TochkaClient({ auth: { sandbox: true } });
const gateway = new PayGatewayClient({ token: "test", baseUrl: "https://pay.example" });
const dynamic: CreateSbpFunctionalLinkRequest = { siteUid: "site", qrcType: "DYNAMIC", amount: { amount: "1.00", currency: "RUB" } };
const staticCode: CreateSbpFunctionalLinkRequest = { siteUid: "site", qrcType: "STATIC" };
const digital: CreateSbpFunctionalLinkRequest = { ...dynamic, paymentMethods: ["DIGITAL_RUBLE"], paymentPageUrl: "https://shop.example/pay" };

void gateway.sbpFunctionalLinks.create(dynamic);
void gateway.cashRegisterQrc.create("site", {});
void gateway.payments.retryRefund("site", "payment", "refund", {
  refundMethod: { type: "CARD", pan: "4111111111111111", cvv2: "123", expirationDate: "12/28" },
});
const retryForm: Promise<{ url: string; expirationDateTime: string }> = gateway.payments.createRefundRetryForm("site", "payment", "refund");
const deleted: Promise<void> = gateway.payments.deleteRefundRetryForm("site", "payment", "refund");
const webhook: Promise<TochkaWebhookEvent> = verifyWebhook("signed-jwt");

function readPayment(operation: PayGatewayOperation): string | undefined {
  if (operation.paymentMethod.type === "DIGITAL_RUBLE") return operation.paymentMethod.operationId;
  if (operation.paymentMethod.type === "DIGITAL_RUBLE_CASH_REGISTER_QRC") return operation.paymentMethod.activationUid;
  return undefined;
}
function readMainUpdates(payment: PaymentForSign, customer: SbpCustomerInfo): (string | undefined)[] {
  return [payment.gisEmail, payment.gisPhoneNumber, customer.DigitalRubleWallet?.walletId];
}
// @ts-expect-error DYNAMIC codes require an amount, including in published declarations.
const invalidCode: CreateSbpFunctionalLinkRequest = { siteUid: "site", qrcType: "DYNAMIC" };
void [bank, staticCode, digital, retryForm, deleted, webhook, readPayment, readMainUpdates, invalidCode, TochkaError];
`;
	for (const extension of ["mts", "cts"]) {
		await Bun.write(join(consumerRoot, `consumer.${extension}`), consumerSource);
	}
	for (const compilerRoot of [resolve(PACKAGE_ROOT, "../.."), PACKAGE_ROOT]) {
		const compiler = Bun.spawn(
			[
				process.execPath,
				join(compilerRoot, "node_modules/typescript/bin/tsc"),
				"--noEmit",
				"--strict",
				"--exactOptionalPropertyTypes",
				"--noUncheckedIndexedAccess",
				"--target",
				"es2022",
				"--module",
				"nodenext",
				"--moduleResolution",
				"nodenext",
				"consumer.mts",
				"consumer.cts",
			],
			{ cwd: consumerRoot, stdout: "inherit", stderr: "inherit" },
		);
		if ((await compiler.exited) !== 0)
			throw new Error(`Packed consumer typecheck failed using ${compilerRoot}`);
	}

	console.log(
		`✓ Package contains ${files.size} files; fresh ESM/CJS imports and consumer types passed`,
	);
} finally {
	await rm(tempRoot, { recursive: true, force: true });
}
