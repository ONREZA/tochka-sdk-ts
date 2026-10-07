import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export interface OpenApiDocument {
	openapi: string;
	info: {
		title: string;
		version: string;
	};
	paths: Record<string, unknown>;
	servers: Array<{
		url: string;
		description?: string;
	}>;
	[key: string]: unknown;
}

const FETCH_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseOpenApi(value: unknown): OpenApiDocument {
	if (!isRecord(value) || typeof value.openapi !== "string" || !value.openapi.startsWith("3.")) {
		throw new Error("Expected an OpenAPI 3.x document");
	}
	if (
		!isRecord(value.info) ||
		typeof value.info.title !== "string" ||
		typeof value.info.version !== "string"
	) {
		throw new Error("OpenAPI info.title and info.version must be strings");
	}
	if (!isRecord(value.paths) || Object.keys(value.paths).length === 0) {
		throw new Error("OpenAPI paths must be a non-empty object");
	}
	if (
		!Array.isArray(value.servers) ||
		value.servers.length === 0 ||
		value.servers.some((server) => !isRecord(server) || typeof server.url !== "string")
	) {
		throw new Error("OpenAPI servers must contain at least one URL");
	}
	return value as OpenApiDocument;
}

export async function readOpenApi(path: string): Promise<OpenApiDocument> {
	return parseOpenApi(JSON.parse(await readFile(path, "utf8")));
}

export async function fetchOpenApi(url: string): Promise<OpenApiDocument> {
	const response = await fetch(url, {
		headers: { "User-Agent": "onreza/tochka-sdk spec-sync" },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
	return parseOpenApi(await response.json());
}

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (!isRecord(value)) return value;
	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, child]) => [key, canonicalize(child)]),
	);
}

export function openApiFingerprint(document: OpenApiDocument): string {
	return createHash("sha256")
		.update(JSON.stringify(canonicalize(document)))
		.digest("hex");
}

export function serializeOpenApi(document: OpenApiDocument): string {
	return `${JSON.stringify(document, null, 2)}\n`;
}

const PAYLOAD_KEYS = new Set(["example", "examples", "default", "enum", "const"]);

function visitSchemas(value: unknown, visit: (schema: Record<string, unknown>) => void) {
	function schema(value: unknown) {
		if (!isRecord(value)) return;
		visit(value);
		for (const key of [
			"properties",
			"patternProperties",
			"dependentSchemas",
			"$defs",
			"definitions",
		])
			if (isRecord(value[key])) for (const child of Object.values(value[key])) schema(child);
		for (const key of [
			"items",
			"additionalProperties",
			"unevaluatedProperties",
			"contains",
			"propertyNames",
			"not",
			"if",
			"then",
			"else",
		])
			schema(value[key]);
		for (const key of ["allOf", "oneOf", "anyOf", "prefixItems"])
			if (Array.isArray(value[key])) for (const child of value[key]) schema(child);
	}
	if (!value || typeof value !== "object") return;
	for (const [key, child] of Object.entries(value)) {
		if (key === "schema") schema(child);
		else if (key === "schemas" && isRecord(child))
			for (const entry of Object.values(child)) schema(entry);
		else if (!PAYLOAD_KEYS.has(key) && !key.startsWith("x-")) visitSchemas(child, visit);
	}
}

/** Pay Gateway uses wire enum values that differ from the schema names inferred without a mapping. */
export function stripUnmappedDiscriminators(value: unknown): unknown {
	const normalized = structuredClone(value);
	visitSchemas(normalized, (schema) => {
		if (
			isRecord(schema.discriminator) &&
			typeof schema.discriminator.propertyName === "string" &&
			!("mapping" in schema.discriminator)
		)
			delete schema.discriminator;
	});
	return normalized;
}

export function normalizePayGatewaySpec(document: OpenApiDocument): OpenApiDocument {
	// Defaults do not require callers to send a property; keep shared response guarantees intact.
	const normalized = stripUnmappedDiscriminators(document) as OpenApiDocument;
	const requestNodes = new Set<object>();
	const responseNodes = new Set<object>();
	function resolveRef(ref: string): unknown {
		let target: unknown = normalized;
		for (const part of decodeURIComponent(ref.slice(2)).split("/")) {
			if (!target || typeof target !== "object") return undefined;
			target = (target as Record<string, unknown>)[part.replace(/~1/g, "/").replace(/~0/g, "~")];
		}
		return target;
	}
	function collect(value: unknown, nodes: Set<object>, namedSchemas = false) {
		if (!value || typeof value !== "object" || nodes.has(value)) return;
		nodes.add(value);
		if (isRecord(value) && typeof value.$ref === "string" && value.$ref.startsWith("#/"))
			collect(resolveRef(value.$ref), nodes);
		for (const [key, child] of Object.entries(value))
			if (namedSchemas || (!PAYLOAD_KEYS.has(key) && !key.startsWith("x-")))
				collect(
					child,
					nodes,
					!namedSchemas &&
						[
							"properties",
							"patternProperties",
							"dependentSchemas",
							"$defs",
							"definitions",
							"schemas",
						].includes(key),
				);
	}
	const visitedPaths = new Set<object>();
	function collectPath(value: unknown) {
		if (!isRecord(value) || visitedPaths.has(value)) return;
		visitedPaths.add(value);
		if (typeof value.$ref === "string" && value.$ref.startsWith("#/"))
			collectPath(resolveRef(value.$ref));
		collect(value.parameters, requestNodes);
		for (const operation of Object.values(value)) {
			if (!isRecord(operation)) continue;
			collect(operation.parameters, requestNodes);
			collect(operation.requestBody, requestNodes);
			collect(operation.responses, responseNodes);
			// Callback payloads are sent by the bank, just like responses and webhooks.
			collect(operation.callbacks, responseNodes);
		}
	}
	for (const path of Object.values(normalized.paths)) collectPath(path);
	collect(normalized.webhooks, responseNodes);
	for (const node of requestNodes) {
		if (responseNodes.has(node) || !isRecord(node) || !isRecord(node.properties)) continue;
		for (const [name, property] of Object.entries(node.properties))
			if (
				isRecord(property) &&
				!responseNodes.has(property) &&
				!(Array.isArray(node.required) && node.required.includes(name))
			)
				delete property.default;
	}
	return normalized;
}
