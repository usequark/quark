import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const temporaryDirectories = [];

after(async () => {
	await Promise.all(
		temporaryDirectories.map((dir) =>
			fs.rm(dir, { recursive: true, force: true }),
		),
	);
});

async function _makeTempDir() {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "deploy-test-"));
	temporaryDirectories.push(dir);
	return dir;
}

async function _writeJson(filePath, value) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(value, null, "\t"));
}

test("deployToRailway validates CLI prerequisites", async () => {
	const { deployToRailway } = await import("./deploy.js");
	assert.equal(typeof deployToRailway, "function");
});

test("inspectProject module loads correctly", async () => {
	const { inspectProject } = await import("./inspect.js");
	assert.equal(typeof inspectProject, "function");
});

test("adapters index exports all expected functions", async () => {
	const mod = await import("./adapters/index.js");
	const expectedExports = [
		"checkRailwayCLI",
		"checkRailwayLogin",
		"deleteService",
		"ensureRailwayProject",
		"ensurePlugin",
		"ensureService",
		"deployService",
		"getExistingVariable",
		"getServiceUrl",
		"setProjectVariables",
		"getProjectDomains",
		"isProjectLinked",
		"listProjects",
		"tryLinkProject",
		"RailwayError",
		"RAILWAY_DIAGNOSTIC_CODES",
	];
	for (const name of expectedExports) {
		assert.ok(name in mod, `Expected export "${name}" to exist`);
	}
});

test("deploy index exports all expected functions", async () => {
	const mod = await import("./index.js");
	const expectedExports = [
		"QUARK_DEPLOY_PROJECT_KIND",
		"QUARK_SERVICE_CONTRACTS",
		"QUARK_SERVICE_KINDS",
		"SUPPORTED_QUARK_SERVICE_KINDS",
		"discoverQuarkDeployProject",
		"formatQuarkDeployDiagnostics",
		"QUARK_DEPLOY_DIAGNOSTIC_CODES",
		"resolveQuarkDeployProject",
		"deployToRailway",
		"inspectProject",
		"checkRailwayCLI",
		"checkRailwayLogin",
		"deleteService",
		"ensureRailwayProject",
		"ensurePlugin",
		"ensureService",
		"deployService",
		"getExistingVariable",
		"getServiceUrl",
		"setProjectVariables",
		"isProjectLinked",
		"listProjects",
		"tryLinkProject",
		"RailwayError",
		"RAILWAY_DIAGNOSTIC_CODES",
	];
	for (const name of expectedExports) {
		assert.ok(name in mod, `Expected export "${name}" to exist`);
	}
});

test("validateProject flags invalid release key in worker railway.json", async () => {
	const { validateProject } = await import("./deploy.js");
	const tmpDir = await _makeTempDir();

	await _writeJson(path.join(tmpDir, "apps/web/railway.json"), {
		$schema: "https://railway.com/railway.schema.json",
		build: { builder: "RAILPACK" },
		deploy: { releaseCommand: "pnpm db:migrate:deploy" },
	});
	await _writeJson(path.join(tmpDir, "apps/worker/railway.json"), {
		$schema: "https://railway.com/railway.schema.json",
		build: { builder: "RAILPACK" },
		deploy: { startCommand: "node src/index.js" },
		release: { command: "pnpm db:migrate:deploy" },
	});

	const discovery = {
		services: [
			{ name: "web", relativeRootDir: "apps/web" },
			{ name: "worker", relativeRootDir: "apps/worker" },
		],
	};

	const { issues } = await validateProject(tmpDir, discovery);

	assert.ok(
		issues.some((i) => i.includes("worker") && i.includes("release")),
		`Expected a release-key issue for the worker, got: ${JSON.stringify(issues)}`,
	);
	assert.ok(
		!issues.some((i) => i.includes('"web"')),
		`Did not expect issues for the web service, got: ${JSON.stringify(issues)}`,
	);
});

test("validateProject warns on unknown top-level keys", async () => {
	const { validateProject } = await import("./deploy.js");
	const tmpDir = await _makeTempDir();

	await _writeJson(path.join(tmpDir, "apps/web/railway.json"), {
		$schema: "https://railway.com/railway.schema.json",
		build: { builder: "RAILPACK" },
		deploy: { releaseCommand: "pnpm db:migrate:deploy" },
		mysteryKey: true,
	});

	const discovery = {
		services: [{ name: "web", relativeRootDir: "apps/web" }],
	};

	const { issues, warnings } = await validateProject(tmpDir, discovery);

	assert.equal(
		issues.length,
		0,
		`Expected no blocking issues, got: ${JSON.stringify(issues)}`,
	);
	assert.ok(
		warnings.some((w) => w.includes("mysteryKey")),
		`Expected a warning about "mysteryKey", got: ${JSON.stringify(warnings)}`,
	);
});

test("validateProject reports missing railway.json", async () => {
	const { validateProject } = await import("./deploy.js");
	const tmpDir = await _makeTempDir();

	const discovery = {
		services: [{ name: "web", relativeRootDir: "apps/web" }],
	};

	const { issues } = await validateProject(tmpDir, discovery);
	assert.ok(
		issues.some((i) => i.includes("missing railway.json")),
		`Expected a missing-file issue, got: ${JSON.stringify(issues)}`,
	);
});
