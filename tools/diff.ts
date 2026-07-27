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
				value,
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

function enumChanges(
	next: unknown,
	prev: unknown,
	path = "",
): Array<{ path: string; added: string[]; removed: string[] }> {
	const changes: Array<{ path: string; added: string[]; removed: string[] }> = [];
	if (Array.isArray(next) || Array.isArray(prev)) {
		const nextItems = Array.isArray(next) ? next : [];
		const prevItems = Array.isArray(prev) ? prev : [];
		for (let index = 0; index < Math.max(nextItems.length, prevItems.length); index += 1) {
			const childPath = `${path}[${index}]`;
			changes.push(...enumChanges(nextItems[index], prevItems[index], childPath));
		}
		return changes;
	}
	const nextObject = asObject(next);
	const prevObject = asObject(prev);
	const nextEnum = strings(nextObject.enum);
	const prevEnum = strings(prevObject.enum);
	if (nextEnum.length > 0 || prevEnum.length > 0) {
		const added = setDiff(nextEnum, prevEnum);
		const removed = setDiff(prevEnum, nextEnum);
		if (added.length > 0 || removed.length > 0) changes.push({ path, added, removed });
	}
	for (const key of new Set([...Object.keys(nextObject), ...Object.keys(prevObject)])) {
		const nextChild = nextObject[key];
		const prevChild = prevObject[key];
		if (
			(nextChild && typeof nextChild === "object") ||
			(prevChild && typeof prevChild === "object")
		) {
			changes.push(...enumChanges(nextChild, prevChild, path ? `${path}.${key}` : key));
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
		return before && !equal(operation.value, before.value);
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

	const schemaChanges: string[] = [];
	for (const name of Object.keys(currentSchemas)) {
		const next = currentSchemas[name];
		const prev = previousSchemas[name];
		if (prev === undefined || equal(next, prev)) continue;

		const nextObject = asObject(next);
		const prevObject = asObject(prev);
		const addedProperties = setDiff(
			Object.keys(asObject(nextObject.properties)),
			Object.keys(asObject(prevObject.properties)),
		);
		const removedProperties = setDiff(
			Object.keys(asObject(prevObject.properties)),
			Object.keys(asObject(nextObject.properties)),
		);
		const addedRequired = setDiff(strings(nextObject.required), strings(prevObject.required));
		const removedRequired = setDiff(strings(prevObject.required), strings(nextObject.required));
		const changes = enumChanges(next, prev);

		for (const property of addedProperties)
			schemaChanges.push(`- \`${name}.${property}\`: добавлено поле`);
		for (const property of removedProperties)
			schemaChanges.push(`- \`${name}.${property}\`: удалено поле ⚠️ breaking`);
		for (const property of addedRequired)
			schemaChanges.push(`- \`${name}.${property}\`: поле стало обязательным ⚠️ breaking`);
		for (const property of removedRequired)
			schemaChanges.push(`- \`${name}.${property}\`: поле стало опциональным`);
		for (const change of changes) {
			const target = change.path ? `${name}.${change.path}` : name;
			for (const value of change.added)
				schemaChanges.push(`- \`${target}\`: добавлено enum-значение \`${value}\``);
			for (const value of change.removed)
				schemaChanges.push(`- \`${target}\`: удалено enum-значение \`${value}\` ⚠️ breaking`);
		}
		if (
			addedProperties.length === 0 &&
			removedProperties.length === 0 &&
			addedRequired.length === 0 &&
			removedRequired.length === 0 &&
			changes.length === 0
		) {
			schemaChanges.push(`- \`${name}\`: изменена структура`);
		}
	}
	if (schemaChanges.length > 0) {
		sections.push(`## Изменены схемы (${schemaChanges.length})`);
		sections.push(schemaChanges.join("\n"));
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
