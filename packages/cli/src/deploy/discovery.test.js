import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import {
	discoverQuarkDeployProject,
	QUARK_DEPLOY_DIAGNOSTIC_CODES,
	resolveQuarkDeployProject,
} from "./discovery.js";

const temporaryDirectories = [];

after(async () => {
	await Promise.all(
		temporaryDirectories.map((directory) =>
			fs.rm(directory, { recursive: true, force: true }),
		),
	);
});

async function writeJson(filePath, value) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(value, null, "\t"));
}

async function createFixture({ hasWeb = true, hasWorker = false } = {}) {
	const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "quark-deploy-"));
	temporaryDirectories.push(projectDir);

	await writeJson(path.join(projectDir, "package.json"), {
		name: "fixture-quark-project",
		private: true,
	});

	if (hasWeb) {
		await writeJson(path.join(projectDir, "apps", "web", "package.json"), {
			name: "@fixture/quark-web",
			private: true,
			type: "module",
		});
	}

	if (hasWorker) {
		await writeJson(path.join(projectDir, "apps", "worker", "package.json"), {
			name: "@fixture/quark-worker",
			private: true,
			type: "module",
		});
	}

	return projectDir;
}

test("resolveQuarkDeployProject discovers web and worker services in a Quark monorepo", async () => {
	const projectDir = await createFixture({ hasWeb: true, hasWorker: true });
	const discovery = await resolveQuarkDeployProject(projectDir);

	assert.equal(discovery.kind, "quark");
	assert.deepEqual(
		discovery.services.map((service) => service.kind),
		["web", "worker"],
	);

	const [webService, workerService] = discovery.services;

	assert.equal(webService.required, true);
	assert.equal(webService.packageName, "@fixture/quark-web");
	assert.equal(webService.relativeRootDir, "apps/web");
	assert.equal(
		webService.runtime.relativeEntrypoint,
		"apps/web/.next/standalone/apps/web/server.js",
	);
	assert.equal(webService.runtime.healthcheckPath, "/api/health");
	assert.equal(
		webService.runtime.entrypointPath,
		path.join(
			projectDir,
			"apps",
			"web",
			".next",
			"standalone",
			"apps",
			"web",
			"server.js",
		),
	);

	assert.equal(workerService.required, false);
	assert.equal(workerService.packageName, "@fixture/quark-worker");
	assert.equal(workerService.relativeRootDir, "apps/worker");
	assert.equal(
		workerService.runtime.relativeEntrypoint,
		"apps/worker/src/index.js",
	);
});

test("resolveQuarkDeployProject accepts a Quark monorepo without a worker service", async () => {
	const projectDir = await createFixture({ hasWeb: true, hasWorker: false });
	const discovery = await resolveQuarkDeployProject(projectDir);

	assert.equal(discovery.diagnostics.length, 0);
	assert.deepEqual(
		discovery.services.map((service) => service.kind),
		["web"],
	);
	assert.equal(discovery.services[0].required, true);
});

test("discoverQuarkDeployProject reports diagnostics and resolveQuarkDeployProject rejects when web is missing", async () => {
	const projectDir = await createFixture({ hasWeb: false, hasWorker: true });
	const discovery = await discoverQuarkDeployProject(projectDir);

	assert.deepEqual(
		discovery.services.map((service) => service.kind),
		["worker"],
	);
	assert.deepEqual(discovery.diagnostics, [
		{
			code: QUARK_DEPLOY_DIAGNOSTIC_CODES.MISSING_REQUIRED_SERVICE,
			serviceKind: "web",
			required: true,
			expectedPath: "apps/web/package.json",
			message: "Missing required Quark web service at apps/web/package.json.",
		},
	]);

	await assert.rejects(
		() => resolveQuarkDeployProject(projectDir),
		(error) => {
			assert.equal(error.code, "QUARK_DEPLOY_DISCOVERY_FAILED");
			assert.equal(error.diagnostics.length, 1);
			assert.match(error.message, /apps\/web\/package\.json/);
			assert.deepEqual(
				error.discovery.services.map((service) => service.kind),
				["worker"],
			);
			return true;
		},
	);
});
