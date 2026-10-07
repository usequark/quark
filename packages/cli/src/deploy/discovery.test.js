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

test("a worker-less project warns that orphaned files are never swept", async () => {
	// `File.uploadedBy` is onDelete: SetNull, so deleting a user orphans their file
	// rows and blobs. CLEANUP_ORPHANED_FILES is the only thing that removes them and
	// it runs in the worker. Without one they accumulate silently, so discovery says
	// so. It is a warning and not a diagnostic: `jobs` is optional, and failing the
	// deploy would punish a legitimate choice.
	const projectDir = await createFixture({ hasWeb: true, hasWorker: false });
	const discovery = await discoverQuarkDeployProject(projectDir);

	assert.deepEqual(discovery.diagnostics, []);
	assert.equal(discovery.warnings.length, 1);
	assert.equal(discovery.warnings[0].code, "missing_worker_service");
	assert.equal(discovery.warnings[0].required, false);
	assert.match(discovery.warnings[0].message, /CLEANUP_ORPHANED_FILES/);
	assert.match(discovery.warnings[0].message, /accumulate indefinitely/);
});

test("a worker-less project still resolves, because the warning does not block", async () => {
	const projectDir = await createFixture({ hasWeb: true, hasWorker: false });

	// resolveQuarkDeployProject throws on diagnostics, so a warning that threw here
	// would make worker-less projects undeployable.
	const discovery = await resolveQuarkDeployProject(projectDir);

	assert.equal(discovery.services.length, 1);
	assert.equal(discovery.warnings.length, 1);
});

test("a project with a worker produces no warning", async () => {
	const projectDir = await createFixture({ hasWeb: true, hasWorker: true });
	const discovery = await discoverQuarkDeployProject(projectDir);

	assert.deepEqual(discovery.warnings, []);
});

test("a worker-only project does not warn about its own missing worker", async () => {
	// There is no web service, so the deployment is already unresolvable. Warning
	// about the missing worker as well would be noise on top of a blocking error.
	const projectDir = await createFixture({ hasWeb: false, hasWorker: true });
	const discovery = await discoverQuarkDeployProject(projectDir);

	assert.deepEqual(discovery.warnings, []);
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
