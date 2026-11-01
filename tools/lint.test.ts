import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

test("lint rejects bugs and focused tests, and safely fixes type imports", async () => {
	const root = resolve(import.meta.dir, "..");
	const directory = await mkdtemp("/var/tmp/tochka-lint-");
	const source = resolve(directory, "lint-contract.test.ts");
	const run = async (...flags: string[]) => {
		const child = Bun.spawn(
			[
				process.execPath,
				resolve(root, "node_modules/oxlint/bin/oxlint"),
				"--config",
				resolve(root, ".oxlintrc.json"),
				"--deny-warnings",
				"--format",
				"json",
				...flags,
				source,
			],
			{ cwd: root, stdout: "pipe", stderr: "pipe" },
		);
		const [exitCode, stdout, stderr] = await Promise.all([
			child.exited,
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
		]);
		expect(stderr).toBe("");
		const { diagnostics } = JSON.parse(stdout) as { diagnostics: { code: string }[] };
		return { exitCode, codes: diagnostics.map(({ code }) => code) };
	};
	try {
		await writeFile(
			source,
			`import { test as check } from "bun:test";
export function value(input: any) {
  const unused = 1;
  for (let i = 0; i < 3; i--) { if (i === 2) return input; }
  return input;
}
check.only("focused", () => {});
`,
		);
		const invalid = await run();
		expect(invalid.exitCode).toBe(1);
		for (const rule of [
			"eslint(for-direction)",
			"eslint(no-unused-vars)",
			"typescript(no-explicit-any)",
			"eslint(no-restricted-properties)",
		]) {
			expect(invalid.codes).toContain(rule);
		}
		const fixable = `import { Stats } from "node:fs";
export function size(value: Stats): number { return value.size; }
`;
		await writeFile(source, fixable);
		expect((await run()).codes).toContain("typescript(consistent-type-imports)");
		expect((await run("--fix")).exitCode).toBe(0);
		expect(await readFile(source, "utf8")).not.toBe(fixable);
		expect(await run()).toEqual({ exitCode: 0, codes: [] });
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
