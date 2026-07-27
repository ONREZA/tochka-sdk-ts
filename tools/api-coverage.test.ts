import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PayGatewayCardTokensModule } from "../packages/tochka-sdk/src/pay-gateway/card-tokens.js";
import { PayGatewayCashRegisterQrcModule } from "../packages/tochka-sdk/src/pay-gateway/cash-register.js";
import { PayGatewayInvoicesModule } from "../packages/tochka-sdk/src/pay-gateway/invoices.js";
import { PayGatewayPaymentsModule } from "../packages/tochka-sdk/src/pay-gateway/payments.js";
import { PayGatewaySbpFunctionalLinksModule } from "../packages/tochka-sdk/src/pay-gateway/sbp.js";

const ROOT = resolve(import.meta.dir, "..");
const MODULES_DIR = resolve(ROOT, "packages", "tochka-sdk", "src", "modules");
const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "head", "options", "trace"]);

const PAY_GATEWAY_WRAPPERS = {
	activateCashRegisterQrCode: [PayGatewayCashRegisterQrcModule.prototype, "activate"],
	cancelInvoice: [PayGatewayInvoicesModule.prototype, "cancel"],
	completePayment: [PayGatewayPaymentsModule.prototype, "complete"],
	createCapture: [PayGatewayPaymentsModule.prototype, "capture"],
	createCashRegisterQrCode: [PayGatewayCashRegisterQrcModule.prototype, "create"],
	createInvoice: [PayGatewayInvoicesModule.prototype, "create"],
	createPayment: [PayGatewayPaymentsModule.prototype, "create"],
	createQRCode: [PayGatewaySbpFunctionalLinksModule.prototype, "create"],
	createRefund: [PayGatewayPaymentsModule.prototype, "refund"],
	deactivateCashRegisterQrCode: [PayGatewayCashRegisterQrcModule.prototype, "deactivate"],
	getCapture: [PayGatewayPaymentsModule.prototype, "getCapture"],
	getCaptures: [PayGatewayPaymentsModule.prototype, "listCaptures"],
	getCashRegisterQrCodeStatus: [PayGatewayCashRegisterQrcModule.prototype, "getStatus"],
	getInvoice: [PayGatewayInvoicesModule.prototype, "get"],
	getPayment: [PayGatewayPaymentsModule.prototype, "get"],
	getPaymentByCashRegisterQrcActivationUid: [
		PayGatewayCashRegisterQrcModule.prototype,
		"getPayment",
	],
	getPaymentsByQrcId: [PayGatewaySbpFunctionalLinksModule.prototype, "listPayments"],
	getQRCode: [PayGatewaySbpFunctionalLinksModule.prototype, "get"],
	getRefund: [PayGatewayPaymentsModule.prototype, "getRefund"],
	getRefunds: [PayGatewayPaymentsModule.prototype, "listRefunds"],
	getTokenizationResult: [PayGatewaySbpFunctionalLinksModule.prototype, "getTokenizationResult"],
	handleCardTokenOperation: [PayGatewayCardTokensModule.prototype, "deactivate"],
} satisfies Record<string, readonly [object, string]>;

const PAY_GATEWAY_CALLBACKS = [
	"captureNotification",
	"paymentNotification",
	"refundNotification",
	"tokenizationDecisionNotification",
] as const;

test("каждая OpenAPI-операция имеет SDK wrapper", async () => {
	const spec = (await Bun.file(resolve(ROOT, "specs", "openapi.json")).json()) as {
		paths?: Record<string, Record<string, unknown>>;
	};
	const operations = new Set<string>();
	for (const [path, methods] of Object.entries(spec.paths ?? {})) {
		for (const method of Object.keys(methods)) {
			if (HTTP_METHODS.has(method)) operations.add(`${method.toUpperCase()} ${path}`);
		}
	}

	const wrappers = new Set<string>();
	for (const file of (await readdir(MODULES_DIR)).filter((name) => name.endsWith(".ts"))) {
		const source = await Bun.file(resolve(MODULES_DIR, file)).text();
		for (const match of source.matchAll(
			/this\.fetch\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE)\(\s*"([^"]+)"/g,
		)) {
			wrappers.add(`${match[1]} ${match[2]}`);
		}
	}

	expect([...operations].filter((operation) => !wrappers.has(operation))).toEqual([]);
	expect([...wrappers].filter((operation) => !operations.has(operation))).toEqual([]);
});

test("каждая исходящая операция Pay Gateway имеет SDK wrapper", async () => {
	const spec = (await Bun.file(resolve(ROOT, "specs", "pay-gateway.json")).json()) as {
		paths?: Record<string, Record<string, unknown>>;
	};
	const outgoing = new Set<string>();
	const callbacks = new Set<string>();
	for (const [path, methods] of Object.entries(spec.paths ?? {})) {
		for (const [method, value] of Object.entries(methods)) {
			if (!HTTP_METHODS.has(method) || !value || typeof value !== "object") continue;
			const operationId = (value as { operationId?: unknown }).operationId;
			if (typeof operationId !== "string") continue;
			(path.startsWith("/merchant-notifications-url/") ? callbacks : outgoing).add(operationId);
		}
	}

	expect([...outgoing].sort()).toEqual(Object.keys(PAY_GATEWAY_WRAPPERS).sort());
	const wrappers: Record<string, readonly [object, string]> = PAY_GATEWAY_WRAPPERS;
	for (const operationId of outgoing) {
		const wrapper = wrappers[operationId];
		expect(wrapper).toBeDefined();
		if (!wrapper) continue;
		const [prototype, method] = wrapper;
		expect(typeof (prototype as Record<string, unknown>)[method]).toBe("function");
	}
	expect([...callbacks].sort()).toEqual([...PAY_GATEWAY_CALLBACKS].sort());
});
