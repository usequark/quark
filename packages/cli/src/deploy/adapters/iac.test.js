// biome-ignore-all lint/suspicious/noTemplateCurlyInString: this file exists to
// exercise Railway's own `${{Service.VAR}}` template syntax and the escaper that
// neutralises a literal `${}`. Both are plain strings by design, and the rule
// cannot tell them apart from a missed template interpolation.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import {
	escapeTsString,
	generateIacFile,
	hasRailwaySdk,
	iacRef,
} from "./iac.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(HERE, "..", "..", "..");
const REPO_ROOT = path.resolve(CLI_ROOT, "..", "..");
const SCAFFOLD_IAC = path.join(
	CLI_ROOT,
	"templates",
	"base-project",
	".railway",
	"railway.ts",
);
const REPO_IAC = path.join(REPO_ROOT, ".railway", "railway.ts");

const temporaryDirectories = [];

after(async () => {
	await Promise.all(
		temporaryDirectories.map((dir) =>
			fs.rm(dir, { recursive: true, force: true }),
		),
	);
});

async function makeTempDir() {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "iac-test-"));
	temporaryDirectories.push(dir);
	return dir;
}

/**
 * Parses TypeScript, throwing esbuild's diagnostic on failure.
 *
 * This is the assertion that was missing. Nothing in this repo ever evaluated
 * `.railway/railway.ts` — the Railway CLI does that at `railway config apply`,
 * in the user's own account — so a generated file that did not parse passed
 * every substring assertion in the suite and still failed on the first real
 * deploy, for every project.
 */
function assertParsesAsTypescript(source, label) {
	try {
		transformSync(source, { loader: "ts", format: "esm" });
	} catch (error) {
		assert.fail(`${label} is not valid TypeScript:\n${error.message}`);
	}
}

/** Collapses formatting so generator output can be diffed against a hand-written file. */
function normaliseTs(source) {
	return source
		.replace(/\/\/[^\n]*/g, "")
		.replace(/,(\s*[}\]])/g, "$1")
		.replace(/\s+/g, " ")
		.trim();
}

const WEB_AND_WORKER = [
	{ name: "web", kind: "web", relativeRootDir: "apps/web" },
	{ name: "worker", kind: "worker", relativeRootDir: "apps/worker" },
];

/** The exact arguments deploy.js passes — the shape that shipped broken. */
function realDeployArgs(projectLabel = "quark-site") {
	return {
		services: WEB_AND_WORKER,
		projectName: projectLabel,
		variableRefs: {
			DATABASE_URL: iacRef("Postgres", "DATABASE_URL"),
			REDIS_URL: iacRef("Redis", "REDIS_URL"),
			NODE_ENV: '"production"',
			APP_NAME: `"${escapeTsString(projectLabel)}"`,
			APP_DESCRIPTION: `"${escapeTsString(`${projectLabel} - Quark application`)}"`,
		},
		secrets: { AUTH_SECRET: "preserve()", NEXTAUTH_SECRET: "preserve()" },
		serviceVars: {
			worker: { WORKER_CONCURRENCY: '"5"' },
			web: {
				AUTH_ALLOW_SIGNUP: '"false"',
				HOSTNAME: '"0.0.0.0"',
				STORAGE_PROVIDER: '"local"',
			},
		},
	};
}

async function generate(args) {
	const dir = await makeTempDir();
	const iacPath = path.join(dir, ".railway", "railway.ts");
	const result = await generateIacFile({ iacPath, ...args });
	return { ...result, iacPath };
}

// --- The syntax regressions ---

test("generated IaC parses as TypeScript", async () => {
	const { content } = await generate(realDeployArgs());
	assertParsesAsTypescript(content, "generated .railway/railway.ts");
});

test("generated IaC parses for a worker-only project with no env vars", async () => {
	// The worker half of the doubled-comma bug: `preDeploy` ended with a comma
	// and the env block began with one, so a worker whose env list was empty
	// shipped `preDeploy: "...",,` — invalid, and now unrepresentable.
	const { content } = await generate({
		services: [
			{ name: "worker", kind: "worker", relativeRootDir: "apps/worker" },
		],
		projectName: "worker-only",
	});
	assertParsesAsTypescript(content, "worker-only generated IaC");
	assert.ok(content.includes('service("worker"'));
});

test("generated IaC never emits a doubled comma separator", async () => {
	const { content } = await generate(realDeployArgs());
	assert.ok(
		!content.includes(",,"),
		`generated IaC contains ",," which does not parse:\n${content}`,
	);
});

test("every Railway reference in the generated IaC is a quoted string", async () => {
	// Bare `${{Postgres.DATABASE_URL}}` parses as an object literal that opens
	// and never closes. The reference syntax only works inside a string.
	const { content } = await generate(realDeployArgs());

	const references = content.match(/\$\{\{/g) ?? [];
	assert.ok(references.length > 0, "expected at least one reference to check");

	const quoted = content.match(/"\$\{\{[^}]+\}\}"/g) ?? [];
	assert.equal(
		quoted.length,
		references.length,
		`every $\{{...}} reference must be quoted; found ${references.length} references but ${quoted.length} quoted:\n${content}`,
	);
});

test("iacRef emits a quoted reference", () => {
	assert.strictEqual(
		iacRef("Postgres", "DATABASE_URL"),
		'"${{Postgres.DATABASE_URL}}"',
	);
});

test("iacRef survives the generator unaltered", async () => {
	const { content } = await generate(realDeployArgs());
	assert.ok(
		content.includes(`DATABASE_URL: ${iacRef("Postgres", "DATABASE_URL")},`),
	);
	assert.ok(content.includes(`REDIS_URL: ${iacRef("Redis", "REDIS_URL")},`));
});

// --- The database-deletion bug (#243) ---

test("generated IaC declares databases it references", async () => {
	// The bug: a second `quark deploy railway` planned to DELETE Postgres and
	// Redis. `generateIacFile` referenced them via ${{Postgres.DATABASE_URL}}
	// but never declared them, and Railway treats an omitted resource in a
	// whole-project file as absent — and absent means delete.
	const { content } = await generate(realDeployArgs());

	assert.ok(
		content.includes('postgres("Postgres")'),
		`generated IaC must declare the Postgres database:\n${content}`,
	);
	assert.ok(
		content.includes('redis("Redis")'),
		`generated IaC must declare the Redis database:\n${content}`,
	);
	assert.ok(
		content.includes("PostgresDb, RedisDb"),
		`both databases must appear in the project resources:\n${content}`,
	);
});

test("generated IaC omits database declarations when no database is referenced", async () => {
	// A project that references no databases must not declare any — otherwise
	// every worker-only or database-less scaffold ships dead code.
	const { content } = await generate({
		services: [{ name: "web", kind: "web", relativeRootDir: "apps/web" }],
		projectName: "no-db",
		variableRefs: { NODE_ENV: '"production"' },
	});

	assert.ok(
		!content.includes("postgres("),
		`no Postgres declaration expected:\n${content}`,
	);
	assert.ok(
		!content.includes("redis("),
		`no Redis declaration declaration expected:\n${content}`,
	);
	assert.ok(
		content.includes("resources: [web]"),
		`resources must contain only the service:\n${content}`,
	);
});

// --- The gap that let all of the above ship ---

test("generated IaC matches the IaC file shipped in every scaffold", async () => {
	// Drift guard. The generator and the hand-written template in
	// templates/base-project have to say the same thing, or a scaffolded
	// project and a deployed one drift apart with nothing noticing.
	//
	// Args are shaped to match the template's key order; deploy.js's own order
	// differs and is covered by the parse test above.
	const { content } = await generate({
		services: WEB_AND_WORKER,
		projectName: "__QUARK_PROJECT_NAME__",
		variableRefs: {
			DATABASE_URL: iacRef("Postgres", "DATABASE_URL"),
			REDIS_URL: iacRef("Redis", "REDIS_URL"),
			NODE_ENV: '"production"',
		},
		secrets: { AUTH_SECRET: "preserve()", NEXTAUTH_SECRET: "preserve()" },
		serviceVars: {
			web: {
				STORAGE_PROVIDER: '"local"',
				AUTH_ALLOW_SIGNUP: '"false"',
				HOSTNAME: '"0.0.0.0"',
			},
			worker: { STORAGE_PROVIDER: '"local"', WORKER_CONCURRENCY: '"5"' },
		},
	});

	const template = await fs.readFile(SCAFFOLD_IAC, "utf8");
	assert.strictEqual(normaliseTs(content), normaliseTs(template));
});

for (const [label, file] of [
	["the scaffold template", SCAFFOLD_IAC],
	["this repo's own .railway/railway.ts", REPO_IAC],
]) {
	test(`${label} parses and imports every helper it calls`, async () => {
		const content = await fs.readFile(file, "utf8");
		assertParsesAsTypescript(content, label);

		const importLine = content.split("\n").find((l) => l.startsWith("import "));
		assert.ok(importLine, `${label} must have an import line`);

		const imported = new Set(
			importLine
				.replace(/^import\s*\{/, "")
				.replace(/\}\s*from.*$/, "")
				.split(",")
				.map((n) => n.trim())
				.filter(Boolean),
		);

		const body = content.slice(content.indexOf("export default"));
		for (const match of body.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
			const name = match[1];
			if (name === "defineRailway") continue;
			assert.ok(
				imported.has(name),
				`${label} calls ${name}() but does not import it — this throws "ReferenceError: ${name} is not defined" at railway config apply`,
			);
		}

		// Pinned by name: PR #229 fixed the scaffold template and the generator
		// but left this repo's own copy calling preserve() without importing it.
		assert.ok(imported.has("preserve"), `${label} must import preserve`);
	});
}

// --- Overwrite behaviour ---

test("generateIacFile leaves an unchanged file untouched", async () => {
	const args = realDeployArgs();
	const first = await generate(args);

	const before = await fs.stat(first.iacPath);
	await new Promise((resolve) => setTimeout(resolve, 20));
	const second = await generateIacFile({ iacPath: first.iacPath, ...args });
	const after = await fs.stat(first.iacPath);

	assert.equal(
		second.changed,
		false,
		"identical content must not report a change",
	);
	assert.equal(second.previous, second.content);
	assert.equal(
		after.mtimeMs,
		before.mtimeMs,
		"identical content must not rewrite the file",
	);
});

test("generateIacFile reports the content it replaced", async () => {
	const dir = await makeTempDir();
	const iacPath = path.join(dir, ".railway", "railway.ts");
	await fs.mkdir(path.dirname(iacPath), { recursive: true });
	await fs.writeFile(iacPath, "// hand-written, do not lose me\n", "utf8");

	const result = await generateIacFile({
		iacPath,
		...realDeployArgs(),
	});

	assert.equal(result.changed, true);
	assert.strictEqual(result.previous, "// hand-written, do not lose me\n");
	assert.strictEqual(await fs.readFile(iacPath, "utf8"), result.content);
});

// --- SDK detection ---

test("hasRailwaySdk finds a hoisted install from a nested directory", async () => {
	const dir = await makeTempDir();
	const pkgDir = path.join(dir, "node_modules", "railway");
	await fs.mkdir(pkgDir, { recursive: true });
	await fs.writeFile(path.join(pkgDir, "package.json"), '{"name":"railway"}');

	assert.equal(await hasRailwaySdk({ cwd: dir }), true);
	assert.equal(
		await hasRailwaySdk({ cwd: path.join(dir, "apps", "web") }),
		true,
	);
});

test("hasRailwaySdk returns false when railway is not installed", async () => {
	const dir = await makeTempDir();
	assert.equal(await hasRailwaySdk({ cwd: dir }), false);
});
