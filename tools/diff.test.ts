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

	test("не скрывает смену типа за добавленным полем", () => {
		const previous = {
			components: { schemas: { Event: { properties: { id: { type: "string" } } } } },
		};
		const current = {
			components: {
				schemas: { Event: { properties: { id: { type: "number" }, extra: { type: "string" } } } },
			},
		};
		const report = buildOpenApiDiff(current, previous);
		expect(report).toContain("`Event.extra`: добавлено поле");
		expect(report).toContain('`Event.id.type`: изменено "string" → "number"');
	});

	test("показывает nested required и числовые enum", () => {
		const previous = {
			components: {
				schemas: { Event: { allOf: [{ required: [], properties: { status: { enum: [1, 2] } } }] } },
			},
		};
		const current = {
			components: {
				schemas: {
					Event: { allOf: [{ required: ["status"], properties: { status: { enum: [1, 3] } } }] },
				},
			},
		};
		const report = buildOpenApiDiff(current, previous);
		expect(report).toContain("`Event.allOf[0].status`: поле стало обязательным ⚠️ breaking");
		expect(report).toContain("удалено enum-значение `2` ⚠️ breaking");
		expect(report).toContain("добавлено enum-значение `3`");
	});

	test("учитывает shared parameters, security, servers и компоненты", () => {
		const previous = {
			paths: { "/item": { parameters: [], get: { responses: {} } } },
			servers: [{ url: "https://old" }],
			security: [],
			components: { parameters: {} },
		};
		const current = {
			paths: {
				"/item": {
					parameters: [{ name: "customerCode", in: "header", required: true }],
					get: { responses: {} },
				},
			},
			servers: [{ url: "https://new" }],
			security: [{ bearer: [] }],
			components: { parameters: { CustomerCode: { name: "customerCode", in: "header" } } },
		};
		const report = buildOpenApiDiff(current, previous);
		expect(report).toContain("`GET /item`");
		expect(report).toContain("`servers`");
		expect(report).toContain("`security`");
		expect(report).toContain("`components.parameters`");
		expect(report).not.toContain("Изменений API-контракта нет.");
	});

	test("отделяет документацию операций от изменения контракта", () => {
		const previous = { paths: { "/item": { get: { description: "Before", responses: {} } } } };
		const current = { paths: { "/item": { get: { description: "After", responses: {} } } } };
		const report = buildOpenApiDiff(current, previous);
		expect(report).toContain("Изменена документация операций (1)");
		expect(report).toContain("`GET /item`");
		expect(report).not.toContain("## Изменены операции");
	});

	test("сравнивает union refs без ложных замен из-за вставки в середину", () => {
		const previous = {
			components: {
				schemas: {
					Result: {
						oneOf: [{ $ref: "#/components/schemas/Card" }, { $ref: "#/components/schemas/Sbp" }],
					},
				},
			},
		};
		const current = {
			components: {
				schemas: {
					Result: {
						oneOf: [
							{ $ref: "#/components/schemas/Card" },
							{ $ref: "#/components/schemas/DigitalRuble" },
							{ $ref: "#/components/schemas/Sbp" },
						],
					},
				},
			},
		};
		const report = buildOpenApiDiff(current, previous);
		expect(report).toContain(
			"`Result.oneOf`: добавлен вариант `#/components/schemas/DigitalRuble`",
		);
		expect(report).not.toContain("изменено");
		expect(report).not.toContain("удалён вариант");
	});
});
