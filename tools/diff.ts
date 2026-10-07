#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { SPEC_TARGETS } from "./specs.js";

const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "head", "options", "trace"]);

type JsonObject = Record<string, unknown>;
type Operation = {
	key: string;
	method: string;
	path: string;
	summary?: string;
	value: unknown;
	contract: unknown;
};

function asObject(value: unknown): JsonObject {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value as JsonObject)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, child]) => [key, canonicalize(child)]),
	);
}

function equal(a: unknown, b: unknown): boolean {
	return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

function collectOperations(spec: JsonObject): Map<string, Operation> {
	const operations = new Map<string, Operation>();
	for (const [path, methodsValue] of Object.entries(asObject(spec.paths))) {
		const shared = Object.fromEntries(
			Object.entries(asObject(methodsValue)).filter(([key]) => !HTTP_METHODS.has(key)),
		);
		for (const [method, value] of Object.entries(asObject(methodsValue))) {
			if (!HTTP_METHODS.has(method)) continue;
			const operation = asObject(value);
			const key = `${method.toUpperCase()} ${path}`;
			const summary =
				typeof operation.summary === "string"
					? operation.summary
					: typeof operation.operationId === "string"
						? operation.operationId
						: undefined;
			operations.set(key, {
				key,
				method,
				path,
				...(summary !== undefined ? { summary } : {}),
				value: { operation: value, shared },
				contract: {
					operation: Object.fromEntries(
						Object.entries(operation).filter(
							([key]) => !["description", "summary", "tags", "externalDocs"].includes(key),
						),
					),
					shared,
				},
			});
		}
	}
	return operations;
}

function getSchemas(spec: JsonObject): JsonObject {
	return asObject(asObject(spec.components).schemas);
}

function strings(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function setDiff(next: readonly string[], prev: readonly string[]): string[] {
	const previous = new Set(prev);
	return next.filter((item) => !previous.has(item));
}

function isReference(value: unknown): value is { $ref: string } {
	const object = asObject(value);
	return Object.keys(object).length === 1 && typeof object.$ref === "string";
}

function schemaChanges(next: unknown, prev: unknown, path: string): string[] {
	if (equal(next, prev)) return [];
	const changes: string[] = [];
	if (Array.isArray(next) && Array.isArray(prev)) {
		const nextItems = next;
		const prevItems = prev;
		for (let index = 0; index < Math.max(nextItems.length, prevItems.length); index += 1) {
			const childPath = `${path}[${index}]`;
			changes.push(...schemaChanges(nextItems[index], prevItems[index], childPath));
		}
		return changes;
	}
	if (
		!next ||
		typeof next !== "object" ||
		!prev ||
		typeof prev !== "object" ||
		Array.isArray(next) !== Array.isArray(prev)
	) {
		return [
			`- \`${path}\`: изменено ${JSON.stringify(prev) ?? "отсутствует"} → ${JSON.stringify(next) ?? "отсутствует"}`,
		];
	}
	const nextObject = asObject(next);
	const prevObject = asObject(prev);
	for (const key of new Set([...Object.keys(nextObject), ...Object.keys(prevObject)])) {
		const nextChild = nextObject[key];
		const prevChild = prevObject[key];
		if (equal(nextChild, prevChild)) continue;
		if (key === "properties") {
			const nextProperties = asObject(nextChild);
			const prevProperties = asObject(prevChild);
			for (const property of new Set([
				...Object.keys(nextProperties),
				...Object.keys(prevProperties),
			])) {
				const childPath = `${path}.${property}`;
				if (!(property in prevProperties)) changes.push(`- \`${childPath}\`: добавлено поле`);
				else if (!(property in nextProperties))
					changes.push(`- \`${childPath}\`: удалено поле ⚠️ breaking`);
				else
					changes.push(
						...schemaChanges(nextProperties[property], prevProperties[property], childPath),
					);
			}
		} else if (key === "required") {
			for (const property of setDiff(strings(nextChild), strings(prevChild)))
				changes.push(`- \`${path}.${property}\`: поле стало обязательным ⚠️ breaking`);
			for (const property of setDiff(strings(prevChild), strings(nextChild)))
				changes.push(`- \`${path}.${property}\`: поле стало опциональным`);
		} else if (
			["oneOf", "anyOf"].includes(key) &&
			Array.isArray(nextChild) &&
			Array.isArray(prevChild) &&
			nextChild.every(isReference) &&
			prevChild.every(isReference)
		) {
			const nextRefs = nextChild.map((item) => item.$ref);
			const prevRefs = prevChild.map((item) => item.$ref);
			for (const ref of setDiff(nextRefs, prevRefs))
				changes.push(`- \`${path}.${key}\`: добавлен вариант \`${ref}\``);
			for (const ref of setDiff(prevRefs, nextRefs))
				changes.push(`- \`${path}.${key}\`: удалён вариант \`${ref}\` ⚠️ breaking`);
		} else if (key === "enum" && Array.isArray(nextChild) && Array.isArray(prevChild)) {
			for (const value of nextChild.filter(
				(value) => !prevChild.some((before) => equal(value, before)),
			))
				changes.push(
					`- \`${path}\`: добавлено enum-значение \`${typeof value === "string" ? value : JSON.stringify(value)}\``,
				);
			for (const value of prevChild.filter(
				(value) => !nextChild.some((after) => equal(value, after)),
			))
				changes.push(
					`- \`${path}\`: удалено enum-значение \`${typeof value === "string" ? value : JSON.stringify(value)}\` ⚠️ breaking`,
				);
		} else {
			changes.push(...schemaChanges(nextChild, prevChild, `${path}.${key}`));
		}
	}
	return changes;
}

function formatOperation(operation: Operation): string {
	return `- \`${operation.key}\`${operation.summary ? ` — ${operation.summary}` : ""}`;
}

export function buildOpenApiDiff(current: JsonObject, previous: JsonObject): string {
	const sections: string[] = [];
	const currentVersion = asObject(current.info).version ?? "?";
	const previousVersion = asObject(previous.info).version ?? "?";
	sections.push(`# API diff: ${String(previousVersion)} → ${String(currentVersion)}`);

	const currentOperations = collectOperations(current);
	const previousOperations = collectOperations(previous);
	const addedOperations = [...currentOperations.values()].filter(
		(operation) => !previousOperations.has(operation.key),
	);
	const removedOperations = [...previousOperations.values()].filter(
		(operation) => !currentOperations.has(operation.key),
	);
	const changedOperations = [...currentOperations.values()].filter((operation) => {
		const before = previousOperations.get(operation.key);
		return before && !equal(operation.contract, before.contract);
	});
	const documentedOperations = [...currentOperations.values()].filter((operation) => {
		const before = previousOperations.get(operation.key);
		return (
			before && equal(operation.contract, before.contract) && !equal(operation.value, before.value)
		);
	});

	if (addedOperations.length > 0) {
		sections.push(`## Добавлены операции (${addedOperations.length})`);
		sections.push(addedOperations.map(formatOperation).join("\n"));
	}
	if (removedOperations.length > 0) {
		sections.push(`## Удалены операции (${removedOperations.length}) ⚠️ breaking`);
		sections.push(removedOperations.map(formatOperation).join("\n"));
	}
	if (changedOperations.length > 0) {
		sections.push(`## Изменены операции (${changedOperations.length})`);
		sections.push(changedOperations.map(formatOperation).join("\n"));
	}
	if (documentedOperations.length > 0) {
		sections.push(`## Изменена документация операций (${documentedOperations.length})`);
		sections.push(documentedOperations.map(formatOperation).join("\n"));
	}
	const unlistedPaths = (spec: JsonObject) =>
		Object.fromEntries(
			Object.entries(asObject(spec.paths)).filter(
				([, value]) => !Object.keys(asObject(value)).some((key) => HTTP_METHODS.has(key)),
			),
		);
	const pathChanges = schemaChanges(unlistedPaths(current), unlistedPaths(previous), "paths");
	if (pathChanges.length) {
		sections.push("## Изменены ссылки и настройки путей");
		sections.push(pathChanges.join("\n"));
	}
	const documentation = (spec: JsonObject) => ({
		info: Object.fromEntries(
			Object.entries(asObject(spec.info)).filter(([key]) => key !== "version"),
		),
		tags: spec.tags,
		externalDocs: spec.externalDocs,
	});
	const documentationChanges = schemaChanges(
		documentation(current),
		documentation(previous),
		"document",
	);
	if (documentationChanges.length) {
		sections.push("## Изменена документация API");
		sections.push(documentationChanges.join("\n"));
	}

	const sharedChanges = new Set<string>();
	for (const key of new Set([...Object.keys(current), ...Object.keys(previous)])) {
		if (["paths", "components", "info", "tags", "externalDocs"].includes(key)) continue;
		if (!equal(current[key], previous[key])) sharedChanges.add(key);
	}
	for (const key of new Set([
		...Object.keys(asObject(current.components)),
		...Object.keys(asObject(previous.components)),
	])) {
		if (key === "schemas") continue;
		if (!equal(asObject(current.components)[key], asObject(previous.components)[key]))
			sharedChanges.add(`components.${key}`);
	}
	if (sharedChanges.size > 0) {
		sections.push(`## Изменены общие настройки (${sharedChanges.size})`);
		sections.push([...sharedChanges].map((key) => `- \`${key}\`: изменена структура`).join("\n"));
	}

	const currentSchemas = getSchemas(current);
	const previousSchemas = getSchemas(previous);
	const addedSchemas = Object.keys(currentSchemas).filter((name) => !(name in previousSchemas));
	const removedSchemas = Object.keys(previousSchemas).filter((name) => !(name in currentSchemas));
	if (addedSchemas.length > 0) {
		sections.push(`## Добавлены схемы (${addedSchemas.length})`);
		sections.push(addedSchemas.map((name) => `- \`${name}\``).join("\n"));
	}
	if (removedSchemas.length > 0) {
		sections.push(`## Удалены схемы (${removedSchemas.length}) ⚠️ breaking`);
		sections.push(removedSchemas.map((name) => `- \`${name}\``).join("\n"));
	}

	const changedSchemas: string[] = [];
	let changedSchemaCount = 0;
	for (const name of Object.keys(currentSchemas)) {
		const next = currentSchemas[name];
		const prev = previousSchemas[name];
		if (prev === undefined || equal(next, prev)) continue;

		const changes = schemaChanges(next, prev, name);
		if (changes.length > 0) changedSchemaCount += 1;
		changedSchemas.push(...changes);
	}
	if (changedSchemas.length > 0) {
		sections.push(`## Изменены схемы (${changedSchemaCount})`);
		sections.push(changedSchemas.join("\n"));
	}

	if (sections.length === 1) sections.push("Изменений API-контракта нет.");
	return `${sections.join("\n\n")}\n`;
}

async function main(): Promise<void> {
	let foundPrevious = false;
	for (const target of SPEC_TARGETS) {
		if (!existsSync(target.previousPath)) continue;
		foundPrevious = true;
		const [current, previous] = await Promise.all([
			Bun.file(target.path).json() as Promise<JsonObject>,
			Bun.file(target.previousPath).json() as Promise<JsonObject>,
		]);
		console.log(`## ${target.label}\n`);
		console.log(buildOpenApiDiff(current, previous));
	}
	if (!foundPrevious) console.log("No previous specs — first run? Skipping diff.");
}

if (import.meta.main) await main();
