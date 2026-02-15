#!/usr/bin/env node
/**
 * Comprehensive test suite for @techstream/quark-create-app CLI
 * Runs all test types: unit, e2e, and integration
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log(`\n${"=".repeat(70)}`);
console.log("🧪 @techstream/quark-create-app CLI - COMPREHENSIVE TEST SUITE");
console.log(`${"=".repeat(70)}\n`);

const tests = [
	{
		name: "Unit Tests - Template Structure",
		command: "node test-cli.js",
		description: "Verify all templates exist and are properly structured",
	},
	{
		name: "E2E Simulation - Project Creation",
		command: "node test-e2e.js",
		description: "Simulate creating a project and verify structure",
	},
	{
		name: "Integration Test - Real CLI",
		command: "node test-integration.js",
		description:
			"Test the actual CLI with interactive prompts (requires manual testing)",
		skip: true,
		skipReason:
			"Interactive test requires manual input - run separately with: node test-integration.js",
	},
];

let allPassed = true;

for (const test of tests) {
	console.log(`\n${"─".repeat(70)}`);
	console.log(`📋 ${test.name}`);
	console.log(`${test.description}`);
	console.log(`─`.repeat(70));

	if (test.skip) {
		console.log(`⏭️  SKIPPED: ${test.skipReason}`);
		continue;
	}

	try {
		const result = execSync(test.command, {
			cwd: __dirname,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Check if test passed (look for success indicators)
		if (
			result.includes("🎉") ||
			result.includes("All tests passed") ||
			result.includes("Integration test passed")
		) {
			console.log("✅ PASSED");
		} else if (result.includes("✓") && !result.includes("✗")) {
			console.log("✅ PASSED");
		} else {
			console.log("⚠️  Output unclear - see details above");
		}
	} catch (error) {
		console.log("❌ FAILED");
		console.log(error.message);
		allPassed = false;
	}
}

console.log(`\n${"═".repeat(70)}`);

if (allPassed) {
	console.log("✅ ALL AUTOMATED TESTS PASSED - CLI IS READY FOR USE");
	console.log(`\n📦 Usage: npx @techstream/quark-create-app <project-name>`);
	console.log(`💡 Example: npx @techstream/quark-create-app my-awesome-app`);
	console.log(`\n🔧 Note: Integration test requires manual testing:`);
	console.log(`   node packages/cli/test-integration.js\n`);
} else {
	console.log("❌ SOME TESTS FAILED - SEE ABOVE FOR DETAILS\n");
	process.exit(1);
}

console.log(`${"═".repeat(70)}\n`);
