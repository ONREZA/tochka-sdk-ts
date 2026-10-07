import { expect, test } from "bun:test";
import {
	normalizePayGatewaySpec,
	openApiFingerprint,
	parseOpenApi,
	stripUnmappedDiscriminators,
} from "./openapi.js";

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
