import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
import {
	normalizePayGatewaySpec,
	openApiFingerprint,
	parseOpenApi,
	stripUnmappedDiscriminators,
} from "./openapi.js";

async function compileNormalized(document: ReturnType<typeof parseOpenApi>, assignments: string) {
	const directory = await mkdtemp(resolve(tmpdir(), "openapi-types-"));
	try {
		const ast = await openapiTS(
			normalizePayGatewaySpec(document) as unknown as Parameters<typeof openapiTS>[0],
		);
		const file = resolve(directory, "types.ts");
		await writeFile(file, `${astToString(ast)}\n${assignments}`);
		const result = Bun.spawnSync([
			process.execPath,
			resolve(import.meta.dir, "../node_modules/typescript/bin/tsc"),
			"--noEmit",
			"--strict",
			"--skipLibCheck",
			"--target",
			"esnext",
			file,
		]);
		expect(result.stdout.toString() + result.stderr.toString()).toBe("");
		expect(result.exitCode).toBe(0);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

test("preserves shared response defaults through callback refs and nested escaped pointers", async () => {
	const content = (schema: unknown) => ({ content: { "application/json": { schema } } });
	const document = parseOpenApi({
		openapi: "3.0.0",
		info: { title: "Test", version: "1" },
		servers: [{ url: "https://example.com" }],
		paths: {
			"/item": {
				post: {
					requestBody: content({ $ref: "#/components/schemas/Input" }),
					responses: {
						200: {
							description: "OK",
							...content({ $ref: "#/components/schemas/Input/properties/a~1b~0c" }),
						},
					},
					callbacks: { result: { $ref: "#/components/callbacks/Result" } },
				},
			},
		},
		components: {
			callbacks: {
				Result: {
					"{$request.body#/url}": {
						post: {
							requestBody: content({ $ref: "#/components/schemas/Callback" }),
							responses: {
								200: { description: "OK", ...content({ $ref: "#/components/schemas/Callback" }) },
							},
						},
					},
				},
			},
			schemas: {
				Input: {
					type: "object",
					properties: {
						optional: { type: "string", default: "input" },
						default: {
							type: "object",
							properties: { level: { type: "string", default: "input" } },
						},
						callback: { $ref: "#/components/schemas/Callback" },
						"a/b~c": { type: "object", properties: { status: { type: "string", default: "OK" } } },
					},
				},
				Callback: { type: "object", properties: { status: { type: "string", default: "OK" } } },
			},
		},
	});
	await compileNormalized(
		document,
		`
		const input: components["schemas"]["Input"] = { default: {} };
		const responseStatus: string = ({} as components["schemas"]["Input"]["a/b~c"])!.status;
		const callbackStatus: string = ({} as components["schemas"]["Callback"]).status;
		void [input, responseStatus, callbackStatus];
	`,
	);
}, 15000);

test("normalization leaves example and default payload objects unchanged", () => {
	const payload = { discriminator: { propertyName: "business-data" }, default: "value" };
	const document = parseOpenApi({
		openapi: "3.0.0",
		info: { title: "Test", version: "1" },
		servers: [{ url: "https://example.com" }],
		paths: { "/item": {} },
		components: {
			schemas: {
				Item: {
					type: "object",
					discriminator: { propertyName: "type" },
					example: payload,
					default: payload,
					properties: { type: { type: "string", enum: ["ITEM"] } },
				},
			},
		},
	});
	const normalized = normalizePayGatewaySpec(document);
	expect(normalized.components).toEqual({
		schemas: {
			Item: {
				type: "object",
				example: payload,
				default: payload,
				properties: { type: { type: "string", enum: ["ITEM"] } },
			},
		},
	});
});

test("semantic fingerprint не зависит от порядка ключей объектов", () => {
	const first = parseOpenApi({
		openapi: "3.1.0",
		info: { title: "API", version: "1" },
		paths: { "/health": { get: { responses: { 200: { description: "OK" } } } } },
		servers: [{ url: "https://api.example" }],
	});
	const second = parseOpenApi({
		servers: [{ url: "https://api.example" }],
		paths: { "/health": { get: { responses: { 200: { description: "OK" } } } } },
		info: { version: "1", title: "API" },
		openapi: "3.1.0",
	});

	expect(openApiFingerprint(first)).toBe(openApiFingerprint(second));
});

test("normalization preserves discriminator payload properties and explicit mappings", () => {
	const unmapped = { propertyName: "type" };
	const mapped = { propertyName: "type", mapping: { CARD: "#/components/schemas/Card" } };
	const wireProperty = { type: "string", enum: ["CARD"] };
	const document = {
		components: {
			schemas: {
				Method: {
					discriminator: unmapped,
					properties: { type: wireProperty, discriminator: { type: "string" } },
				},
				MappedMethod: { discriminator: mapped },
			},
		},
	};
	const before = structuredClone(document);
	expect(stripUnmappedDiscriminators(document)).toEqual({
		components: {
			schemas: {
				Method: { properties: { type: wireProperty, discriminator: { type: "string" } } },
				MappedMethod: { discriminator: mapped },
			},
		},
	});
	expect(document).toEqual(before);
});

test("normalizes optional defaults only in transitive request-only schemas", () => {
	const document = parseOpenApi({
		openapi: "3.0.0",
		info: { title: "Test", version: "1" },
		servers: [{ url: "https://example.com" }],
		paths: {
			"/item": {
				post: {
					requestBody: { $ref: "#/components/requestBodies/Input" },
					responses: {
						200: {
							content: { "application/json": { schema: { $ref: "#/components/schemas/Shared" } } },
						},
					},
				},
			},
		},
		components: {
			requestBodies: {
				Input: {
					content: { "application/json": { schema: { $ref: "#/components/schemas/Input" } } },
				},
			},
			schemas: {
				Input: {
					required: ["required"],
					properties: {
						required: { type: "string", default: "x" },
						child: { $ref: "#/components/schemas/Child" },
						shared: { $ref: "#/components/schemas/Shared" },
					},
				},
				Child: {
					properties: {
						optional: { type: "string", default: "x" },
						recursive: { $ref: "#/components/schemas/Child" },
					},
				},
				Shared: { properties: { optional: { type: "string", default: "x" } } },
			},
		},
	});
	const before = structuredClone(document);
	const expected = structuredClone(before);
	delete (
		expected.components as {
			schemas: { Child: { properties: { optional: { default?: string } } } };
		}
	).schemas.Child.properties.optional.default;
	expect(normalizePayGatewaySpec(document)).toEqual(expected);
	expect(document).toEqual(before);
});
