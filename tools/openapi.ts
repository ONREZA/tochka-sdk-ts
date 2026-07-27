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
