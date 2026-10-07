import { afterAll, beforeAll, expect, test } from "bun:test";
import { X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const CA_PATH = resolve(ROOT, "tools/certs/russian-trusted-root-ca.pem");
let directory: string;
let server: ReturnType<typeof Bun.serve>;
let bundlePath: string;
const document = {
	openapi: "3.1.0",
	info: { title: "TLS regression", version: "1" },
	paths: { "/health": {} },
	servers: [{ url: "https://127.0.0.1" }],
};

function openssl(...args: string[]) {
	const result = Bun.spawnSync(["openssl", ...args], { cwd: directory });
	if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

beforeAll(async () => {
	directory = await mkdtemp(resolve(tmpdir(), "spec-tls-"));
	openssl(
		"req",
		"-x509",
		"-newkey",
		"rsa:2048",
		"-nodes",
		"-days",
		"2",
		"-keyout",
		"ca.key",
		"-out",
		"ca.pem",
		"-subj",
		"/CN=Spec Sync Test CA",
		"-addext",
		"basicConstraints=critical,CA:TRUE",
		"-addext",
		"keyUsage=critical,keyCertSign,cRLSign",
	);
	openssl(
		"req",
		"-new",
		"-newkey",
		"rsa:2048",
		"-nodes",
		"-keyout",
		"leaf.key",
		"-out",
		"leaf.csr",
		"-subj",
		"/CN=Spec Sync Test",
	);
	await writeFile(
		resolve(directory, "leaf.ext"),
		"subjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n",
	);
	openssl(
		"x509",
		"-req",
		"-in",
		"leaf.csr",
		"-CA",
		"ca.pem",
		"-CAkey",
		"ca.key",
		"-CAcreateserial",
		"-out",
		"leaf.pem",
		"-days",
		"2",
		"-extfile",
		"leaf.ext",
	);
	const ca = await readFile(resolve(directory, "ca.pem"), "utf8");
	bundlePath = resolve(directory, "bundle.pem");
	await writeFile(bundlePath, `${await readFile(CA_PATH, "utf8")}\n${ca}`);
	server = Bun.serve({
		hostname: "::",
		port: 0,
		tls: {
			key: await readFile(resolve(directory, "leaf.key")),
			cert: `${await readFile(resolve(directory, "leaf.pem"), "utf8")}\n${ca}`,
		},
		fetch: () => Response.json(document),
	});
});

afterAll(async () => {
	server?.stop(true);
	if (directory) await rm(directory, { recursive: true, force: true });
});

async function fetchInFreshBun(host: string, caPath?: string) {
	const env = { ...process.env };
	for (const key of Object.keys(env)) {
		if (
			/proxy$/i.test(key) ||
			key === "NODE_EXTRA_CA_CERTS" ||
			key === "NODE_TLS_REJECT_UNAUTHORIZED"
		) {
			delete env[key];
		}
	}
	if (caPath) env.NODE_EXTRA_CA_CERTS = caPath;
	const child = Bun.spawn(
		[
			process.execPath,
			"-e",
			`import { fetchOpenApi } from ${JSON.stringify(resolve(ROOT, "tools/openapi.ts"))};
		try { console.log(JSON.stringify(await fetchOpenApi(process.argv.at(-1)))); }
		catch (error) { console.error(error.code ?? error.message); process.exit(1); }`,
			`https://${host}:${server.port}/spec.json`,
		],
		{ env, stdout: "pipe", stderr: "pipe" },
	);
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { exitCode, stdout, stderr };
}

test("sync trusts the reviewed CA only in the sync step", async () => {
	const workflow = Bun.YAML.parse(
		await readFile(resolve(ROOT, ".github/workflows/sync-openapi.yml"), "utf8"),
	) as {
		env?: Record<string, string>;
		jobs: {
			sync: {
				env: Record<string, string>;
				steps: Array<{ id?: string; env?: Record<string, string> }>;
			};
		};
	};
	expect(workflow.env?.NODE_EXTRA_CA_CERTS).toBeUndefined();
	expect(workflow.jobs.sync.env.NODE_EXTRA_CA_CERTS).toBeUndefined();
	const sync = workflow.jobs.sync.steps.find((step) => step.id === "sync");
	expect(sync?.env?.NODE_EXTRA_CA_CERTS?.replace(/^\$\{\{ github\.workspace \}\}/, ROOT)).toBe(
		CA_PATH,
	);
	for (const step of workflow.jobs.sync.steps.filter((step) => step.id !== "sync")) {
		expect(step.env?.NODE_EXTRA_CA_CERTS).toBeUndefined();
	}
	const certificate = new X509Certificate(await readFile(CA_PATH));
	expect(certificate.ca).toBe(true);
	expect(certificate.verify(certificate.publicKey)).toBe(true);
	expect(certificate.fingerprint256).toBe(
		"D2:6D:2D:02:31:B7:C3:9F:92:CC:73:85:12:BA:54:10:35:19:E4:40:5D:68:B5:BD:70:3E:97:88:CA:8E:CF:31",
	);
});

test("fetchOpenApi accepts a valid chain with a startup extra CA bundle", async () => {
	const result = await fetchInFreshBun("127.0.0.1", bundlePath);
	expect(result.stderr).toBe("");
	expect(result.exitCode).toBe(0);
	expect(JSON.parse(result.stdout)).toEqual(document);
});

test("fetchOpenApi rejects a chain not signed by the configured CA", async () => {
	const result = await fetchInFreshBun("127.0.0.1", CA_PATH);
	expect(result.exitCode).toBe(1);
	expect(result.stderr).toContain("SELF_SIGNED_CERT_IN_CHAIN");
});

test("fetchOpenApi still checks hostnames when the CA is trusted", async () => {
	const result = await fetchInFreshBun("localhost", bundlePath);
	expect(result.exitCode).toBe(1);
	expect(result.stderr).toContain("ERR_TLS_CERT_ALTNAME_INVALID");
});
