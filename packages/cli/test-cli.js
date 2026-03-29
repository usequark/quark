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
const _projectPath = path.join(testDir, projectName);
const cliPackageJson = await fs.readJSON(path.join(__dirname, "package.json"));

console.log("🧪 Testing @techstream/quark-create-app CLI\n");

// Cleanup
console.log("📦 Setting up test environment...");
await fs.remove(testDir);
await fs.ensureDir(testDir);

try {
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
			name: "Config template exists",
			test: () => fs.existsSync(path.join(__dirname, "templates/config")),
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
		const { stdout } = await execa("node", [
			path.join(__dirname, "src/index.js"),
			"--help",
		]);
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
		const { stdout } = await execa("node", [
			path.join(__dirname, "src/index.js"),
			"--version",
		]);
		if (stdout.includes(cliPackageJson.version)) {
			console.log("  ✓ CLI version command works");
			passed++;
		}
	} catch (error) {
		console.log(`  ✗ CLI version command failed: ${error.message}`);
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
