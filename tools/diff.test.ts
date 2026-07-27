import { describe, expect, test } from "bun:test";
import { buildOpenApiDiff } from "./diff.js";

describe("buildOpenApiDiff", () => {
	test("показывает schema-only изменения enum и properties", () => {
		const previous = {
			info: { version: "1.0" },
			components: {
				schemas: {
					Event: {
						type: "object",
						properties: { type: { enum: ["known"] } },
					},
				},
			},
		};
		const current = {
			info: { version: "1.1" },
			components: {
				schemas: {
					Event: {
						type: "object",
						properties: {
							type: { enum: ["known", "custom"] },
							payload: { type: "object" },
						},
					},
					Token: { type: "object" },
				},
			},
		};

		const report = buildOpenApiDiff(current, previous);
		expect(report).toContain("Добавлены схемы (1)");
		expect(report).toContain("`Token`");
		expect(report).toContain("`Event.payload`: добавлено поле");
		expect(report).toContain("добавлено enum-значение `custom`");
	});

	test("показывает добавленные, удалённые и изменённые операции", () => {
		const previous = {
			info: { version: "1.0" },
			paths: {
				"/old": { get: { operationId: "old" } },
				"/changed": { get: { operationId: "changed", summary: "Before" } },
			},
		};
		const current = {
			info: { version: "2.0" },
			paths: {
				"/new": { post: { operationId: "new" } },
				"/changed": { get: { operationId: "changed", summary: "After" } },
			},
		};

		const report = buildOpenApiDiff(current, previous);
		expect(report).toContain("`POST /new`");
		expect(report).toContain("`GET /old`");
		expect(report).toContain("`GET /changed`");
	});

	test("показывает удалённые enum-значения внутри composed schema arrays", () => {
		const previous = {
			components: {
				schemas: {
					Event: {
						oneOf: [{ allOf: [{ enum: ["known", "removed"] }] }],
					},
				},
			},
		};
		const current = {
			components: {
				schemas: {
					Event: {
						oneOf: [{ allOf: [{ enum: ["known"] }] }],
					},
				},
			},
		};

		const report = buildOpenApiDiff(current, previous);
		expect(report).toContain(
			"`Event.oneOf[0].allOf[0]`: удалено enum-значение `removed` ⚠️ breaking",
		);
	});
});
