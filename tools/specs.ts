import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

export interface SpecTarget {
	id: "tochka" | "pay-gateway";
	label: string;
	url: string;
	path: string;
	previousPath: string;
	generatedPath: string;
}

export const SPEC_TARGETS: readonly SpecTarget[] = [
	{
		id: "tochka",
		label: "Tochka API",
		url: process.env.TOCHKA_SPEC_URL ?? "https://enter.tochka.com/doc/openapi/swagger.json",
		path: resolve(ROOT, "specs", "openapi.json"),
		previousPath: resolve(ROOT, "specs", "openapi.prev.json"),
		generatedPath: resolve(ROOT, "packages", "tochka-sdk", "src", "_generated", "schema.d.ts"),
	},
	{
		id: "pay-gateway",
		label: "Pay Gateway",
		url:
			process.env.TOCHKA_PAY_GATEWAY_SPEC_URL ??
			"https://api.tochka.com/static/v1/pay-gateway/docs/tochka-pay-gateway.json",
		path: resolve(ROOT, "specs", "pay-gateway.json"),
		previousPath: resolve(ROOT, "specs", "pay-gateway.prev.json"),
		generatedPath: resolve(ROOT, "packages", "tochka-sdk", "src", "_generated", "pay-gateway.d.ts"),
	},
];
