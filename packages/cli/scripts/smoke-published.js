#!/usr/bin/env node

import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { execa } from "execa";
import fs from "fs-extra";

const rawArgs = process.argv.slice(2);
const parsedArgs = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

const { values } = parseArgs({
	args: parsedArgs,
	options: {
		"cli-version": {
			type: "string",
			default: "latest",
		},
		"cli-spec": {
			type: "string",
		},
		"core-version": {
			type: "string",
			default: "latest",
		},
		"core-spec": {
			type: "string",
		},
		"keep-temp": {
			type: "boolean",
			default: false,
		},
	},
});

const cliVersion = values["cli-version"];
const cliSpec = values["cli-spec"];
const coreVersion = values["core-version"];
const coreSpec = values["core-spec"];
const keepTemp = values["keep-temp"];
const cliPackageSpec = cliSpec ?? `@techstream/quark-create-app@${cliVersion}`;
const corePackageSpec = coreSpec ?? `@techstream/quark-core@${coreVersion}`;
const cliLabel = cliSpec ? path.basename(cliSpec) : cliVersion;
const coreLabel = coreSpec ? path.basename(coreSpec) : coreVersion;

const workspaceRoot = path.join(
	tmpdir(),
	`quark-published-smoke-${Date.now()}`,
);
const createProjectDir = path.join(workspaceRoot, "published-create");
const addProjectDir = path.join(workspaceRoot, "published-add");
const coreProjectDir = path.join(workspaceRoot, "published-core");

const CORE_IMPORT_SMOKE = `
import assert from "node:assert/strict";
import * as core from "@techstream/quark-core";
import * as auth from "@techstream/quark-core/auth";
import * as errors from "@techstream/quark-core/errors";
import * as storage from "@techstream/quark-core/storage";
import * as testing from "@techstream/quark-core/testing";

assert.equal(typeof core.createAuthConfig, "function");
assert.equal(typeof auth.createAuthConfig, "function");
assert.equal(typeof auth.requireAuth, "function");
assert.equal(typeof errors.AppError, "function");
assert.equal(typeof errors.ValidationError, "function");
assert.equal(typeof storage.createStorage, "function");
assert.equal(typeof storage.getAssetUrl, "function");
assert.equal(typeof testing.createTestUser, "function");

console.log("Core imports resolved successfully.");
`;

function section(title) {
	console.log(`\n== ${title} ==`);
}

async function run(command, args, options = {}) {
	const renderedArgs = args.join(" ");
	console.log(`$ ${command} ${renderedArgs}`);
	await execa(command, args, {
		cwd: options.cwd ?? process.cwd(),
		stdio: "inherit",
		env: {
			...process.env,
			...options.env,
		},
	});
}

async function cleanupDocker(projectDir) {
	try {
		await run("docker", ["compose", "down", "-v"], { cwd: projectDir });
	} catch (error) {
		console.warn(
			`Docker cleanup failed for ${projectDir}: ${error.shortMessage ?? error.message}`,
		);
	}
}

async function runCoreImportCheck(projectDir) {
	await run("node", ["--input-type=module", "--eval", CORE_IMPORT_SMOKE], {
		cwd: projectDir,
	});
}

async function scaffoldProject({ name, features }) {
	await run(
		"pnpm",
		[
			"dlx",
			cliPackageSpec,
			name,
			"--no-prompts",
			"--features",
			features,
			"--skip-docker",
		],
		{ cwd: workspaceRoot },
	);

	return path.join(workspaceRoot, name);
}

async function validateScaffold(projectDir) {
	await runCoreImportCheck(path.join(projectDir, "apps/web"));
	await run("docker", ["compose", "up", "-d"], { cwd: projectDir });

	try {
		await run("pnpm", ["doctor:ci"], { cwd: projectDir });
		await run("pnpm", ["test"], { cwd: projectDir });
		await run("pnpm", ["build"], { cwd: projectDir });
	} finally {
		await cleanupDocker(projectDir);
	}
}

async function runCreateSmoke() {
	section(`CLI create smoke (${cliLabel})`);
	const projectDir = await scaffoldProject({
		name: path.basename(createProjectDir),
		features: "ui,jobs,admin,cms",
	});
	await validateScaffold(projectDir);
}

async function runAddSmoke() {
	section(`CLI add smoke (${cliLabel})`);
	const projectDir = await scaffoldProject({
		name: path.basename(addProjectDir),
		features: "ui,jobs",
	});

	await run("pnpm", ["dlx", cliPackageSpec, "add", "cms", "--no-prompts"], {
		cwd: projectDir,
	});
	await run("pnpm", ["install"], { cwd: projectDir });
	await validateScaffold(projectDir);
}

async function runStandaloneCoreSmoke() {
	section(`Core import smoke (${coreLabel})`);
	await fs.ensureDir(coreProjectDir);
	await fs.writeJson(
		path.join(coreProjectDir, "package.json"),
		{
			name: "published-core-smoke",
			private: true,
			version: "1.0.0",
			type: "module",
		},
		{ spaces: 2 },
	);

	await run("pnpm", ["add", corePackageSpec, "next", "react", "react-dom"], {
		cwd: coreProjectDir,
	});
	await runCoreImportCheck(coreProjectDir);
}

async function main() {
	console.log(`Working directory: ${workspaceRoot}`);
	await fs.remove(workspaceRoot);
	await fs.ensureDir(workspaceRoot);

	try {
		await runCreateSmoke();
		await runAddSmoke();
		await runStandaloneCoreSmoke();
		console.log("\nPublished package smoke checks passed.");

		if (!keepTemp) {
			await fs.remove(workspaceRoot);
		}
	} catch (error) {
		console.error("\nPublished package smoke checks failed.");
		console.error(error.shortMessage ?? error.message);
		console.error(`Artifacts preserved at: ${workspaceRoot}`);
		process.exit(1);
	}

	if (keepTemp) {
		console.log(`Artifacts preserved at: ${workspaceRoot}`);
	}
}

await main();
