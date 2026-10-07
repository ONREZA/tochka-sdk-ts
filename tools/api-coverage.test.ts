import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";
import { PayGatewayClient } from "../packages/tochka-sdk/src/pay-gateway/index.js";

const ROOT = resolve(import.meta.dir, "..");
const MODULES_DIR = resolve(ROOT, "packages", "tochka-sdk", "src", "modules");
const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "head", "options", "trace"]);

const ID = "test/id? #";
const AMOUNT = { amount: "1.00", currency: "RUB" };
const PAY_GATEWAY_WRAPPERS = {
	activateCashRegisterQrCode: (client) =>
		client.cashRegisterQrc.activate(ID, ID, "MERCHANT", { activationUid: ID, amount: AMOUNT }),
	cancelInvoice: (client) => client.invoices.cancel(ID, ID),
	completePayment: (client) => client.payments.complete(ID, ID, { paRes: "signed-3ds-result" }),
	createCapture: (client) => client.payments.capture(ID, ID, { captureUid: ID, amount: AMOUNT }),
	createCashRegisterQrCode: (client) => client.cashRegisterQrc.create(ID, {}),
	createInvoice: (client) =>
		client.invoices.create(ID, {
			invoiceUid: ID,
			amount: AMOUNT,
			expirationDateTime: "2026-10-08T00:00:00Z",
		}),
	createPayment: (client) =>
		client.payments.create({
			siteUid: ID,
			paymentUid: ID,
			amount: AMOUNT,
			paymentMethod: { type: "SBP_TOKEN", token: "token" },
		}),
	createQRCode: (client) => client.sbpFunctionalLinks.create({ siteUid: ID, qrcType: "STATIC" }),
	createRefund: (client) => client.payments.refund(ID, ID, { refundUid: ID, amount: AMOUNT }),
	createRetryForm: (client) => client.payments.createRefundRetryForm(ID, ID, ID),
	deactivateCashRegisterQrCode: (client) => client.cashRegisterQrc.deactivate(ID, ID, "MERCHANT"),
	deleteRetryForm: (client) => client.payments.deleteRefundRetryForm(ID, ID, ID),
	getCapture: (client) => client.payments.getCapture(ID, ID, ID),
	getCaptures: (client) => client.payments.listCaptures(ID, ID),
	getCashRegisterQrCodeStatus: (client) => client.cashRegisterQrc.getStatus(ID, ID, "MERCHANT"),
	getInvoice: (client) => client.invoices.get(ID, ID),
	getPayment: (client) => client.payments.get(ID, ID),
	getPaymentByCashRegisterQrcActivationUid: (client) =>
		client.cashRegisterQrc.getPayment(ID, ID, ID, "MERCHANT"),
	getPaymentsByQrcId: (client) =>
		client.sbpFunctionalLinks.listPayments(ID, ID, { qrcIdType: "MERCHANT" }),
	getQRCode: (client) => client.sbpFunctionalLinks.get(ID, ID, { qrcIdType: "MERCHANT" }),
	getRefund: (client) => client.payments.getRefund(ID, ID, ID),
	getRefunds: (client) => client.payments.listRefunds(ID, ID),
	getTokenizationResult: (client) =>
		client.sbpFunctionalLinks.getTokenizationResult(ID, ID, "MERCHANT"),
	handleCardTokenOperation: (client) =>
		client.cardTokens.deactivate(ID, {
			operation: "DEACTIVATE_TOKEN",
			account: "account",
			token: "token",
		}),
	retryRefund: (client) =>
		client.payments.retryRefund(ID, ID, ID, {
			refundMethod: { type: "CARD", pan: "4111111111111111", expirationDate: "12/28", cvv2: "123" },
		}),
} satisfies Record<string, (client: PayGatewayClient) => Promise<unknown>>;

interface GatewayParameter {
	$ref?: string;
	name?: string;
	in?: string;
	required?: boolean;
}

interface GatewaySpec {
	paths: Record<
		string,
		Record<
			string,
			{
				operationId: string;
				parameters?: GatewayParameter[];
				requestBody?: unknown;
			}
		>
	>;
	components: { parameters: Record<string, GatewayParameter> };
}

function parameters(
	spec: GatewaySpec,
	operation: { parameters?: GatewayParameter[] },
): GatewayParameter[] {
	return (operation.parameters ?? []).map((parameter) =>
		parameter.$ref
			? (spec.components.parameters[parameter.$ref.split("/").at(-1) ?? ""] ?? parameter)
			: parameter,
	);
}

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
		function visit(node: ts.Node): void {
			if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
				const { expression: receiver, name: method } = node.expression;
				const path = node.arguments[0];
				if (
					HTTP_METHODS.has(method.text.toLowerCase()) &&
					ts.isPropertyAccessExpression(receiver) &&
					receiver.expression.kind === ts.SyntaxKind.ThisKeyword &&
					receiver.name.text === "fetch" &&
					path &&
					ts.isStringLiteral(path)
				)
					wrappers.add(`${method.text.toUpperCase()} ${path.text}`);
			}
			ts.forEachChild(node, visit);
		}
		visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true));
	}

	expect([...operations].filter((operation) => !wrappers.has(operation))).toEqual([]);
	expect([...wrappers].filter((operation) => !operations.has(operation))).toEqual([]);
});

test("Pay Gateway wrappers send the OpenAPI method, encoded path, Data and Signature", async () => {
	const spec = (await Bun.file(resolve(ROOT, "specs/pay-gateway.json")).json()) as GatewaySpec;
	const keypair = (await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	)) as CryptoKeyPair;
	const requests: { url: URL; init: RequestInit }[] = [];
	const client = new PayGatewayClient({
		token: "jwt",
		baseUrl: "https://pay.example",
		privateKey: keypair.privateKey,
		fetch: (async (url: RequestInfo | URL, init?: RequestInit) => {
			requests.push({ url: new URL(String(url)), init: init ?? {} });
			return Response.json({ Data: {} });
		}) as unknown as typeof fetch,
	});
	const wrappers: Record<string, (client: PayGatewayClient) => Promise<unknown>> =
		PAY_GATEWAY_WRAPPERS;
	const outgoing: string[] = [];
	const callbacks: string[] = [];
	for (const [path, methods] of Object.entries(spec.paths)) {
		for (const [method, operation] of Object.entries(methods)) {
			if (!HTTP_METHODS.has(method)) continue;
			if (path.startsWith("/merchant-notifications-url/")) {
				callbacks.push(operation.operationId);
				continue;
			}
			outgoing.push(operation.operationId);
			const wrapper = wrappers[operation.operationId];
			expect(wrapper, operation.operationId).toBeDefined();
			if (!wrapper) continue;
			requests.length = 0;
			await wrapper(client);
			expect(requests.length, operation.operationId).toBe(1);
			const request = requests[0];
			if (!request) continue;
			expect(request.init.method, operation.operationId).toBe(method.toUpperCase());
			expect(request.url.pathname, operation.operationId).toBe(
				`/uapi/pay${path.replace(/\{([^}]+)\}/g, (_match, name: string) =>
					name === "apiVersion" ? "v1.0" : encodeURIComponent(ID),
				)}`,
			);
			for (const parameter of parameters(spec, operation)) {
				if (parameter.in === "query" && parameter.required && parameter.name) {
					expect(request.url.searchParams.has(parameter.name), operation.operationId).toBe(true);
				}
			}
			if (operation.requestBody) {
				const body = JSON.parse(String(request.init.body));
				expect(Object.keys(body), operation.operationId).toEqual(["Data"]);
				expect(body.Data.siteUid, operation.operationId).toBeUndefined();
			} else expect(request.init.body, operation.operationId).toBeUndefined();
			const signature = new Headers(request.init.headers).get("Signature");
			const requiresSignature = parameters(spec, operation).some(
				(parameter) =>
					parameter.in === "header" && parameter.name === "Signature" && parameter.required,
			);
			if (requiresSignature) {
				expect(signature, operation.operationId).toBeDefined();
				expect(
					await crypto.subtle.verify(
						"RSASSA-PKCS1-v1_5",
						keypair.publicKey,
						Uint8Array.from(atob(signature ?? ""), (char) => char.charCodeAt(0)),
						new TextEncoder().encode(String(request.init.body)),
					),
					operation.operationId,
				).toBe(true);
			} else expect(signature, operation.operationId).toBeNull();
		}
	}
	expect(outgoing.sort()).toEqual(Object.keys(PAY_GATEWAY_WRAPPERS).sort());
	expect(callbacks.sort()).toEqual([...PAY_GATEWAY_CALLBACKS].sort());
});

test("Pay Gateway Signature headers require a key before any request is sent", async () => {
	const spec = (await Bun.file(resolve(ROOT, "specs/pay-gateway.json")).json()) as GatewaySpec;
	let requests = 0;
	let signedOperations = 0;
	const client = new PayGatewayClient({
		token: "jwt",
		baseUrl: "https://pay.example",
		fetch: (async () => {
			requests += 1;
			return Response.json({});
		}) as unknown as typeof fetch,
	});
	for (const [path, methods] of Object.entries(spec.paths)) {
		for (const [method, operation] of Object.entries(methods)) {
			if (!HTTP_METHODS.has(method)) continue;
			if (
				!parameters(spec, operation).some(
					(parameter) =>
						parameter.in === "header" && parameter.name === "Signature" && parameter.required,
				)
			)
				continue;
			signedOperations += 1;
			const requestPath = `/uapi/pay${path.replace(/\{([^}]+)\}/g, (_match, name: string) =>
				name === "apiVersion" ? "v1.0" : encodeURIComponent(ID),
			)}`;
			await expect(client.request(method, requestPath, { Data: {} })).rejects.toThrow(
				/requires signed body/,
			);
		}
	}
	expect(signedOperations).toBeGreaterThan(0);
	expect(requests).toBe(0);
});

test("OpenAPI sync preserves public input types and the new unions", () => {
	const program = ts.createProgram(
		[resolve(ROOT, "packages/tochka-sdk/test/types/openapi-sync.ts")],
		{
			strict: true,
			exactOptionalPropertyTypes: true,
			noEmit: true,
			skipLibCheck: true,
			types: [],
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.NodeNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
		},
	);
	const errors = ts
		.getPreEmitDiagnostics(program)
		.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
	expect(errors).toEqual([]);
});
