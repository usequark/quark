#!/usr/bin/env node
/**
 * Build verification test for @techstream/quark-create-app CLI
 * Runs: scaffold -> install -> build for non-interactive default and CMS scenarios
 *
 * Enable with: QUARK_CLI_BUILD_TEST=1 node test-build.js
 */

import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(tmpdir(), "quark-cli-build-test");
const BUILD_SCENARIOS = [
	{
		name: "default",
		projectName: "cli-build-default-app",
		features: "ui,jobs",
	},
	{
		name: "cms",
		projectName: "cli-build-cms-app",
		features: "cms",
	},
];
const REQUIRED_ANALYTICS_FILES = [
	"apps/web/src/app/_components/UmamiReplayRecorder.js",
	"apps/web/src/lib/analytics/umami-config.js",
	"apps/web/src/lib/analytics/umami-replay.js",
	"apps/web/src/lib/analytics/umami.js",
];

if (!process.env.QUARK_CLI_BUILD_TEST) {
	console.log("⏭️  Skipping build test (set QUARK_CLI_BUILD_TEST=1 to run)");
	process.exit(0);
}

await fs.remove(testDir);
await fs.ensureDir(testDir);

console.log("🧪 Build Test: Non-interactive Scaffold -> Install -> Build\n");

async function assertGeneratedAnalytics(projectPath) {
	for (const relativePath of REQUIRED_ANALYTICS_FILES) {
		if (!(await fs.pathExists(path.join(projectPath, relativePath)))) {
			throw new Error(`Missing generated analytics file: ${relativePath}`);
		}
	}

	const webPackage = await fs.readJson(
		path.join(projectPath, "apps/web/package.json"),
	);
	if (webPackage.dependencies?.rrweb !== "2.0.0-alpha.4") {
		throw new Error("Generated web app is missing the rrweb dependency");
	}
}

async function runScenario({ name, projectName, features }) {
	const scenarioDir = path.join(testDir, name);
	const projectPath = path.join(scenarioDir, projectName);
	const cliPath = path.join(__dirname, "src/index.js");

	await fs.ensureDir(scenarioDir);

	console.log(`📦 Scaffolding ${name} project (${features || "none"})...`);
	await execa(
		"node",
		[
			cliPath,
			projectName,
			"--no-prompts",
			"--features",
			features,
			"--signup",
			"enabled",
			"--skip-docker",
		],
		{
			cwd: scenarioDir,
			stdio: "inherit",
		},
	);

	if (!(await fs.pathExists(projectPath))) {
		throw new Error(`Project directory not created for scenario: ${name}`);
	}

	await assertGeneratedAnalytics(projectPath);

	console.log(`\n🏗️  Running web build for ${name}...\n`);
	await execa("pnpm", ["--filter", `@${projectName}/web`, "build"], {
		cwd: projectPath,
		stdio: "inherit",
	});

	console.log(`\n✅ ${name} build completed successfully\n`);
}

try {
	for (const scenario of BUILD_SCENARIOS) {
		await runScenario(scenario);
	}

	console.log("\n✅ Build completed successfully\n");
} catch (error) {
	console.error("\n❌ Build test failed:\n");
	console.error(error.message || error);
	process.exit(1);
} finally {
	await fs.remove(testDir);
}
