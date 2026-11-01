import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		webhooks: "src/webhooks/index.ts",
		"pay-gateway": "src/pay-gateway/index.ts",
		errors: "src/errors/index.ts",
	},
	format: "esm",
	platform: "neutral",
	target: "es2022",
	dts: true,
	publint: { strict: true },
	attw: {
		profile: "esm-only",
		level: "error",
	},
	sourcemap: true,
	treeshake: true,
	clean: true,
	minify: false,
	hash: false,
	deps: {
		neverBundle: true,
	},
});
