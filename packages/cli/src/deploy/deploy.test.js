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
