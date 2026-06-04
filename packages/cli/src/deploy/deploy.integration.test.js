import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.join(__dirname, "../../src/index.js");
const temporaryDirectories = [];

after(async () => {
	await Promise.all(
		temporaryDirectories.map((dir) =>
			fs.rm(dir, { recursive: true, force: true }),
		),
	);
});

async function makeTempDir() {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "deploy-int-"));
	temporaryDirectories.push(dir);
	return dir;
}

async function writeJson(filePath, value) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(value, null, "\t"));
}

/**
 * Create a fixture that looks like a Quark project with web + worker.
 */
async function createQuarkFixture() {
	const projectDir = await makeTempDir();

	// Root package.json
	await writeJson(path.join(projectDir, "package.json"), {
		name: "@test/quark-app",
		private: true,
		type: "module",
	});

	// apps/web
	await writeJson(path.join(projectDir, "apps", "web", "package.json"), {
		name: "@test/quark-web",
		private: true,
		type: "module",
	});

	// apps/worker
	await writeJson(path.join(projectDir, "apps", "worker", "package.json"), {
		name: "@test/quark-worker",
		private: true,
		type: "module",
	});

	return projectDir;
}

// ---------------------------------------------------------------------------
// Level 2: Integration — deployToRailway with missing Railway CLI
// ---------------------------------------------------------------------------

test("deployToRailway exits with code 1 when Railway CLI is not installed", async () => {
	const projectDir = await createQuarkFixture();

	const result = spawnSync(
		process.execPath,
		[
			"--import",
			`data:text/javascript,import { setFlagsFromString } from "node:v8"; setFlagsFromString("--allow-worker");`,
			"-e",
			`
				import { deployToRailway } from "${path.join(__dirname, "deploy.js")}";
				try {
					await deployToRailway({ cwd: "${projectDir}", provision: false });
					process.exit(0);
				} catch (e) {
					console.error("Unexpected error:", e.message);
					process.exit(2);
				}
			`,
		],
		{
			encoding: "utf8",
			timeout: 15_000,
			env: { ...process.env, PATH: "/dev/null" },
		},
	);

	assert.equal(result.status, 1);
	assert.match(result.stderr || result.stdout, /Railway CLI not found/);
});

// ---------------------------------------------------------------------------
// Level 2: Integration — adapter functions with mocked project
// ---------------------------------------------------------------------------

test("isProjectLinked returns false for unlinked project", async () => {
	const { isProjectLinked } = await import("./adapters/railway.js");
	const projectDir = await createQuarkFixture();
	const result = await isProjectLinked(projectDir);
	assert.equal(result, false);
});

test("isProjectLinked returns true after creating .railway directory with config", async () => {
	const { isProjectLinked } = await import("./adapters/railway.js");
	const projectDir = await createQuarkFixture();
	const railwayDir = path.join(projectDir, ".railway");
	await fs.mkdir(railwayDir, { recursive: true });
	await fs.writeFile(
		path.join(railwayDir, "config.json"),
		JSON.stringify({ projectId: "test-123" }),
	);
	const result = await isProjectLinked(projectDir);
	assert.equal(result, true);
});

// ---------------------------------------------------------------------------
// Level 2: Integration — resolveQuarkDeployProject with fixtures
// ---------------------------------------------------------------------------

test("resolveQuarkDeployProject discovers web + worker in fixture", async () => {
	const { resolveQuarkDeployProject } = await import("./discovery.js");
	const projectDir = await createQuarkFixture();
	const discovery = await resolveQuarkDeployProject(projectDir);

	assert.equal(discovery.kind, "quark");
	assert.equal(discovery.services.length, 2);
	assert.equal(discovery.services[0].kind, "web");
	assert.equal(discovery.services[1].kind, "worker");
});

test("resolveQuarkDeployProject fails when web is missing", async () => {
	const { resolveQuarkDeployProject } = await import("./discovery.js");
	const projectDir = await makeTempDir();

	// Only root package.json, no apps/web
	await writeJson(path.join(projectDir, "package.json"), {
		name: "@test/quark-app",
		private: true,
	});

	await assert.rejects(() => resolveQuarkDeployProject(projectDir), {
		code: "QUARK_DEPLOY_DISCOVERY_FAILED",
	});
});

// ---------------------------------------------------------------------------
// Level 2: Integration — inspectProject with fixture
// ---------------------------------------------------------------------------

test("inspectProject loads and inspects fixture without error", async () => {
	const { inspectProject } = await import("./inspect.js");
	const projectDir = await createQuarkFixture();

	// Should not throw — just logs output
	await inspectProject({ cwd: projectDir });
});

// ---------------------------------------------------------------------------
// Level 2: CLI command routing
// ---------------------------------------------------------------------------

test("quark deploy --help shows subcommands", () => {
	const result = spawnSync(process.execPath, [CLI_ENTRY, "deploy", "--help"], {
		encoding: "utf8",
		timeout: 10_000,
	});

	assert.equal(result.status, 0);
	assert.match(result.stdout, /railway/);
	assert.match(result.stdout, /inspect/);
});

test("quark deploy railway --help shows options", () => {
	const result = spawnSync(
		process.execPath,
		[CLI_ENTRY, "deploy", "railway", "--help"],
		{
			encoding: "utf8",
			timeout: 10_000,
		},
	);

	assert.equal(result.status, 0);
	assert.match(result.stdout, /project-name/);
	assert.match(result.stdout, /project-id/);
	assert.match(result.stdout, /dry-run/);
});

test("quark deploy inspect --help shows help", () => {
	const result = spawnSync(
		process.execPath,
		[CLI_ENTRY, "deploy", "inspect", "--help"],
		{
			encoding: "utf8",
			timeout: 10_000,
		},
	);

	assert.equal(result.status, 0);
});
