import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		webhooks: "src/webhooks/index.ts",
		"pay-gateway": "src/pay-gateway/index.ts",
		errors: "src/errors/index.ts",
	},
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	target: "node18",
	sourcemap: true,
	treeshake: true,
	// splitting: true позволяет tsup вынести общий код (jose, core/http, errors)
	// в shared chunk — webhooks и pay-gateway не дублируют jose при использовании
	// обоих subpath-экспортов одним потребителем.
	splitting: true,
	minify: false,
	platform: "neutral",
});
