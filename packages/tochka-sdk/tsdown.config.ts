import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		webhooks: "src/webhooks/index.ts",
		"pay-gateway": "src/pay-gateway/index.ts",
		errors: "src/errors/index.ts",
	},
	format: ["esm", "cjs"],
	platform: "neutral",
	target: "es2022",
	dts: true,
	publint: true,
	attw: {
		// Название профиля описывает dual-package resolution, а не engines.node.
		profile: "node16",
		level: "error",
	},
	sourcemap: true,
	treeshake: true,
	clean: true,
	minify: false,
	fixedExtension: false,
	hash: false,
	deps: {
		neverBundle: true,
	},
});
