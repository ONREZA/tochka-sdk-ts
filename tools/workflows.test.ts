import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("release publication requires a full verification of the same tag", async () => {
	const root = resolve(import.meta.dir, "..");
	const workflow = Bun.YAML.parse(
		await readFile(resolve(root, ".github/workflows/release.yml"), "utf8"),
	) as {
		jobs: Record<
			string,
			{
				needs?: string | string[];
				steps: { uses?: string; run?: string; with?: Record<string, string> }[];
			}
		>;
	};
	const verify = workflow.jobs.verify;
	const publish = workflow.jobs.publish;
	expect(verify).toBeDefined();
	expect(publish).toBeDefined();
	expect([publish?.needs].flat()).toContain("verify");
	expect(verify?.steps.some((step) => step.run === "bun run verify")).toBe(true);
	const tag = (steps: NonNullable<typeof verify>["steps"]) =>
		steps.find((step) => step.uses?.startsWith("actions/checkout@"))?.with?.ref;
	expect(tag(verify?.steps ?? [])).toMatch(/^\$\{\{\s*needs\.release\.outputs\.tag\s*\}\}$/);
	expect(tag(publish?.steps ?? [])).toBe(tag(verify?.steps ?? []));
});
