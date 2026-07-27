import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const temporaryDirectories = [];

after(async () => {
	await Promise.all(
		temporaryDirectories.map((dir) =>
			fs.rm(dir, { recursive: true, force: true, maxRetries: 3 }),
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

	await writeJson(path.join(projectDir, "package.json"), {
		name: "@test/quark-app",
		private: true,
		type: "module",
	});

	await writeJson(path.join(projectDir, "apps", "web", "package.json"), {
		name: "@test/quark-web",
		private: true,
		type: "module",
	});

	await writeJson(path.join(projectDir, "apps", "worker", "package.json"), {
		name: "@test/quark-worker",
		private: true,
		type: "module",
	});

	return projectDir;
}

function runQuarkCli(args) {
	const cliEntry = path.join(__dirname, "../../src/index.js");
	try {
		const result = execSync(
			`${process.execPath} ${cliEntry} ${args.join(" ")}`,
			{
				encoding: "utf8",
				timeout: 10_000,
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		return result;
	} catch (error) {
		// execSync throws on non-zero exit — return stdout if available
		if (error.stdout) return error.stdout.toString("utf8");
		throw error;
	}
}

// ---------------------------------------------------------------------------
// Level 2: Integration - deployToRailway with missing Railway CLI
// ---------------------------------------------------------------------------

test("checkRailwayCLI returns null when railway is not on PATH", async () => {
	const { checkRailwayCLI } = await import("./adapters/railway.js");
	const origPath = process.env.PATH;
	process.env.PATH = "/dev/null";
	try {
		const result = await checkRailwayCLI();
		assert.equal(result, null);
	} finally {
		process.env.PATH = origPath;
	}
});

// ---------------------------------------------------------------------------
// Level 2: Integration - adapter functions with mocked project
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
// Level 2: Integration - resolveQuarkDeployProject with fixtures
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

	await writeJson(path.join(projectDir, "package.json"), {
		name: "@test/quark-app",
		private: true,
	});

	await assert.rejects(() => resolveQuarkDeployProject(projectDir), {
		code: "QUARK_DEPLOY_DISCOVERY_FAILED",
	});
});

// ---------------------------------------------------------------------------
// Level 2: Integration - inspectProject with fixture
// ---------------------------------------------------------------------------

test("inspectProject loads and inspects fixture without error", async () => {
	const { inspectProject } = await import("./inspect.js");
	const projectDir = await createQuarkFixture();

	await inspectProject({ cwd: projectDir });
});

// ---------------------------------------------------------------------------
// Level 2: CLI command routing
// ---------------------------------------------------------------------------

test("quark deploy --help shows subcommands", () => {
	const stdout = runQuarkCli(["deploy", "--help"]);

	assert.match(stdout, /railway/);
	assert.match(stdout, /inspect/);
});

test("quark deploy railway --help shows options", () => {
	const stdout = runQuarkCli(["deploy", "railway", "--help"]);

	assert.match(stdout, /project-name/);
	assert.match(stdout, /project-id/);
	assert.match(stdout, /dry-run/);
});

test("quark deploy inspect --help shows help", () => {
	const stdout = runQuarkCli(["deploy", "inspect", "--help"]);

	assert.ok(stdout.length > 0);
});
