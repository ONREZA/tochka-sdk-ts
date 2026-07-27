import { expect, test } from "bun:test";
import { openApiFingerprint, parseOpenApi } from "./openapi.js";

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
