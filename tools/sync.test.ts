import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

test("sync rolls back generation failures, retries, and clears stale no-change reports", async () => {
	const directory = await mkdtemp("/var/tmp/tochka-sync-");
	const root = resolve(import.meta.dir, "..");
	const generated = "packages/tochka-sdk/src/_generated";
	const document = (version: string) => ({
		openapi: "3.0.0",
		info: { title: "Test", version },
		servers: [{ url: "https://uapi.example.com" }, { url: "https://sandbox.example.com" }],
		paths: { "/item": { get: { responses: { 200: { description: "OK" } } } } },
	});
	let next: unknown = { ...document("2"), servers: [{ url: "https://uapi.example.com" }] };
	let invalidGateway = false;
	const server = Bun.serve({
		port: 0,
		fetch: (request) =>
			new URL(request.url).pathname === "/gateway"
				? Response.json(invalidGateway ? { error: "not an OpenAPI document" } : document("1"))
				: Response.json(next),
	});
	const run = async (tool: string) => {
		const process = Bun.spawn(["bun", `tools/${tool}.ts`], {
			cwd: directory,
			env: {
				...globalThis.process.env,
				TOCHKA_SPEC_URL: `${server.url}main`,
				TOCHKA_PAY_GATEWAY_SPEC_URL: `${server.url}gateway`,
			},
			stdout: "pipe",
			stderr: "pipe",
		});
		const [exitCode, stdout, stderr] = await Promise.all([
			process.exited,
			new Response(process.stdout).text(),
			new Response(process.stderr).text(),
		]);
		return { exitCode, stdout, stderr };
	};
	try {
		await Promise.all(
			["tools", "specs", generated].map((path) =>
				mkdir(resolve(directory, path), { recursive: true }),
			),
		);
		await symlink(resolve(root, "node_modules"), resolve(directory, "node_modules"));
		await writeFile(resolve(directory, "package.json"), '{"type":"module"}\n');
		await Promise.all(
			["openapi", "specs", "diff", "gen", "sync", "fetch-spec"].map((tool) =>
				copyFile(resolve(root, `tools/${tool}.ts`), resolve(directory, `tools/${tool}.ts`)),
			),
		);
		const originals = new Map([
			["specs/openapi.json", JSON.stringify(document("1"))],
			["specs/pay-gateway.json", JSON.stringify(document("1"))],
			["specs/openapi.prev.json", JSON.stringify(document("0"))],
			[`${generated}/schema.d.ts`, "previous main types"],
			[`${generated}/pay-gateway.d.ts`, "previous gateway types"],
			[`${generated}/meta.ts`, "previous metadata"],
		]);
		await Promise.all(
			[...originals].map(([path, content]) => writeFile(resolve(directory, path), content)),
		);
		const brokenGateway = {
			...document("1"),
			paths: {
				"/item": {
					get: {
						responses: {
							200: {
								description: "OK",
								content: {
									"application/json": { schema: { $ref: "#/components/schemas/Missing" } },
								},
							},
						},
					},
				},
			},
		};
		await writeFile(resolve(directory, "specs/pay-gateway.json"), JSON.stringify(brokenGateway));
		expect((await run("gen")).exitCode).toBe(1);
		for (const [path, content] of originals)
			if (path.startsWith(generated))
				expect(await readFile(resolve(directory, path), "utf8")).toBe(content);
		await writeFile(resolve(directory, "specs/pay-gateway.json"), JSON.stringify(document("1")));
		await writeFile(resolve(directory, "specs/openapi.json"), JSON.stringify(next));
		expect((await run("gen")).exitCode).toBe(1);
		for (const [path, content] of originals)
			if (path.startsWith(generated))
				expect(await readFile(resolve(directory, path), "utf8")).toBe(content);
		await writeFile(resolve(directory, "specs/openapi.json"), JSON.stringify(document("1")));
		const report = resolve(directory, ".sync-report.md");
		await writeFile(report, "stale report");
		expect((await run("sync")).exitCode).toBe(1);
		for (const [path, content] of originals)
			expect(await readFile(resolve(directory, path), "utf8")).toBe(content);
		expect(existsSync(report)).toBe(false);

		// A fetch failure for one target must not advance the other snapshot.
		next = document("2");
		invalidGateway = true;
		expect((await run("fetch-spec")).exitCode).toBe(1);
		for (const [path, content] of originals)
			expect(await readFile(resolve(directory, path), "utf8")).toBe(content);
		invalidGateway = false;
		expect((await run("sync")).exitCode).toBe(0);
		expect(
			JSON.parse(await readFile(resolve(directory, "specs/openapi.json"), "utf8")).info.version,
		).toBe("2");
		expect(
			JSON.parse(await readFile(resolve(directory, "specs/openapi.prev.json"), "utf8")).info
				.version,
		).toBe("1");
		expect(await readFile(report, "utf8")).toContain("1 → 2");
		expect(await readFile(resolve(directory, `${generated}/meta.ts`), "utf8")).toContain('"2"');
		expect((await run("sync")).exitCode).toBe(100);
		expect(existsSync(report)).toBe(false);
		next = document("3");
		expect((await run("sync")).exitCode).toBe(0);
		expect(
			JSON.parse(await readFile(resolve(directory, "specs/openapi.prev.json"), "utf8")).info
				.version,
		).toBe("2");
		expect(await readFile(report, "utf8")).toContain("2 → 3");
	} finally {
		server.stop(true);
		await rm(directory, { recursive: true, force: true });
	}
}, 20000);
