#!/usr/bin/env node

/**
 * Test script for @techstream/quark-create-app CLI
 * Run with: node packages/cli/test-cli.js
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, "../../tmp-test-project");
const projectName = "my-test-quark-app";
const projectPath = path.join(testDir, projectName);
const cliEntry = path.join(__dirname, "src/index.js");
const cliPackageJson = await fs.readJSON(path.join(__dirname, "package.json"));

console.log("🧪 Testing @techstream/quark-create-app CLI\n");

try {
	// Cleanup
	console.log("📦 Setting up test environment...");
	await fs.remove(testDir);
	await fs.ensureDir(testDir);
	// Test 1: Create project with interactive CLI
	console.log(`\n📝 Creating test project: ${projectName}`);

	// Use prompts with automated selections
	// We'll manually test by simulating the operations the CLI would do
	console.log("✓ Testing CLI structure (simulated)");

	// Test 2: Verify base project structure
	console.log("\n✅ Test Results:\n");

	const checks = [
		{
			name: "CLI executable exists",
			test: () => fs.existsSync(path.join(__dirname, "src/index.js")),
		},
		{
			name: "Base project template exists",
			test: () => fs.existsSync(path.join(__dirname, "templates/base-project")),
		},
		{
			name: "Base template has package.json",
			test: () =>
				fs.existsSync(
					path.join(__dirname, "templates/base-project/package.json"),
				),
		},
		{
			name: "Base template has turbo.json",
			test: () =>
				fs.existsSync(
					path.join(__dirname, "templates/base-project/turbo.json"),
				),
		},
		{
			name: "Base template has docker-compose.yml",
			test: () =>
				fs.existsSync(
					path.join(__dirname, "templates/base-project/docker-compose.yml"),
				),
		},
		{
			name: "Base template has START_HERE guide",
			test: () =>
				fs.existsSync(
					path.join(__dirname, "templates/base-project/docs/START_HERE.md"),
				),
		},
		{
			name: "Base template has FIRST_FEATURE guide",
			test: () =>
				fs.existsSync(
					path.join(__dirname, "templates/base-project/docs/FIRST_FEATURE.md"),
				),
		},
		{
			name: "UI template exists",
			test: () => fs.existsSync(path.join(__dirname, "templates/ui")),
		},
		{
			name: "UI template has components",
			test: () => {
				const uiSrc = path.join(__dirname, "templates/ui/src");
				return (
					fs.existsSync(path.join(uiSrc, "button.js")) &&
					fs.existsSync(path.join(uiSrc, "index.js")) &&
					fs.existsSync(path.join(uiSrc, "logo.js")) &&
					fs.existsSync(path.join(uiSrc, "error-banner.js"))
				);
			},
		},
		{
			name: "Jobs template exists",
			test: () => fs.existsSync(path.join(__dirname, "templates/jobs")),
		},
		{
			name: "Jobs template has definitions",
			test: () =>
				fs.existsSync(
					path.join(__dirname, "templates/jobs/src/definitions.js"),
				),
		},
		{
			name: "Jobs template has README",
			test: () =>
				fs.existsSync(path.join(__dirname, "templates/jobs/README.md")),
		},
		{
			name: "Config template exists",
			test: () => fs.existsSync(path.join(__dirname, "templates/config")),
		},
		{
			name: "Admin template has README",
			test: () =>
				fs.existsSync(path.join(__dirname, "templates/admin/README.md")),
		},
		{
			name: "CMS starter exists",
			test: () =>
				fs.existsSync(
					path.join(
						__dirname,
						"templates/starters/cms/apps/web/src/app/api/cms/route.js",
					),
				),
		},
	];

	let passed = 0;
	let failed = 0;

	for (const check of checks) {
		try {
			const result = check.test();
			if (result) {
				console.log(`  ✓ ${check.name}`);
				passed++;
			} else {
				console.log(`  ✗ ${check.name}`);
				failed++;
			}
		} catch (error) {
			console.log(`  ✗ ${check.name}: ${error.message}`);
			failed++;
		}
	}

	// Test 3: Test CLI execution with help flag
	console.log("\n📋 Testing CLI help command...");
	try {
		const { stdout } = await execa("node", [cliEntry, "--help"]);
		if (stdout.includes("quark-create-app")) {
			console.log("  ✓ CLI help command works");
			passed++;
		}
	} catch (error) {
		console.log(`  ✗ CLI help command failed: ${error.message}`);
		failed++;
	}

	// Test 4: Test CLI version
	console.log("\n📋 Testing CLI version command...");
	try {
		const { stdout } = await execa("node", [cliEntry, "--version"]);
		if (stdout.includes(cliPackageJson.version)) {
			console.log("  ✓ CLI version command works");
			passed++;
		}
	} catch (error) {
		console.log(`  ✗ CLI version command failed: ${error.message}`);
		failed++;
	}

	// Test 5: Scaffold smoke test + scaffold drift report
	console.log("\n📋 Testing scaffold generation and drift reporting...");
	try {
		await execa(
			"node",
			[
				cliEntry,
				projectName,
				"--no-prompts",
				"--skip-install",
				"--skip-docker",
				"--features",
				"ui,admin",
				"--signup",
				"disabled",
			],
			{
				cwd: testDir,
			},
		);

		const adrReadme = await fs.readFile(
			path.join(projectPath, "docs", "adr", "README.md"),
			"utf8",
		);
		if (
			adrReadme.includes(projectName) &&
			!adrReadme.includes("__QUARK_PROJECT_NAME__")
		) {
			console.log("  ✓ ADR README placeholders are substituted");
			passed++;
		} else {
			console.log("  ✗ ADR README placeholders were not substituted");
			failed++;
		}

		const { stdout: cleanDriftOutput } = await execa(
			"node",
			[cliEntry, "update", "--scaffold-check"],
			{
				cwd: projectPath,
			},
		);
		if (cleanDriftOutput.includes("No scaffold drift detected")) {
			console.log("  ✓ Clean scaffold passes drift check");
			passed++;
		} else {
			console.log("  ✗ Clean scaffold reported unexpected drift");
			failed++;
		}

		const quarkLinkPath = path.join(projectPath, ".quark-link.json");
		const quarkLink = await fs.readJSON(quarkLinkPath);
		quarkLink.packages = ["ui"];
		await fs.writeFile(
			quarkLinkPath,
			`${JSON.stringify(quarkLink, null, 2)}\n`,
		);

		const { stdout: mismatchOutput } = await execa(
			"node",
			[cliEntry, "update", "--scaffold-check"],
			{
				cwd: projectPath,
			},
		);
		if (
			mismatchOutput.includes("used the union") &&
			mismatchOutput.includes("No scaffold drift detected")
		) {
			console.log("  ✓ Drift check handles feature metadata mismatches safely");
			passed++;
		} else {
			console.log("  ✗ Drift check did not preserve the union behavior");
			failed++;
		}

		await fs.appendFile(
			path.join(projectPath, "README.md"),
			"\n<!-- scaffold drift smoke test -->\n",
		);
		const { stdout: driftOutput } = await execa(
			"node",
			[cliEntry, "update", "--scaffold-check"],
			{
				cwd: projectPath,
			},
		);
		if (
			driftOutput.includes("Scaffold drift detected") &&
			driftOutput.includes("README.md")
		) {
			console.log("  ✓ Drift report surfaces changed scaffold files");
			passed++;
		} else {
			console.log("  ✗ Drift report did not surface the modified README");
			failed++;
		}

		const failOnDriftRun = await execa(
			"node",
			[cliEntry, "update", "--scaffold-check", "--fail-on-drift"],
			{
				cwd: projectPath,
				reject: false,
			},
		);
		if (
			failOnDriftRun.exitCode === 1 &&
			failOnDriftRun.stdout.includes("Scaffold drift detected") &&
			failOnDriftRun.stderr.includes("--fail-on-drift was set")
		) {
			console.log("  ✓ fail-on-drift returns a CI-friendly non-zero exit");
			passed++;
		} else {
			console.log(
				"  ✗ fail-on-drift did not return the expected non-zero exit",
			);
			failed++;
		}
	} catch (error) {
		console.log(
			`  ✗ Scaffold generation/drift report failed: ${error.stderr || error.message}`,
		);
		failed++;
	}

	// Summary
	console.log(`\n${"=".repeat(50)}`);
	console.log(`Tests passed: ${passed}/${passed + failed}`);

	if (failed === 0) {
		console.log("🎉 All tests passed!\n");
		process.exit(0);
	} else {
		console.log(`❌ ${failed} test(s) failed\n`);
		process.exit(1);
	}
} catch (error) {
	console.error("\n❌ Test failed:", error.message);
	process.exit(1);
} finally {
	// Cleanup
	await fs.remove(testDir);
}
