#!/usr/bin/env node
/**
 * Pre-push hook runner.
 *
 * Runs changeset check and tests, but skips tests if node_modules is missing
 * (CI will catch failures anyway).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

function run(cmd, opts = {}) {
	return execSync(cmd, { stdio: "inherit", ...opts });
}

// Check if node_modules exists
const hasNodeModules = fs.existsSync("node_modules");

console.log("🔍 Pre-push checks...\n");

// Always run changeset check
console.log("📋 Checking changesets...");
try {
	run("node scripts/check-changeset.mjs");
	console.log("✅ Changeset check passed\n");
} catch {
	process.exit(1);
}

// Skip tests if node_modules is missing
if (!hasNodeModules) {
	console.log("⏭️  Skipping tests (node_modules not found)");
	console.log("   Run 'pnpm install' first, or tests will run in CI.\n");
	process.exit(0);
}

// Run tests
console.log("🧪 Running tests...");
try {
	run("pnpm test");
	console.log("\n✅ All checks passed\n");
} catch {
	console.error("\n❌ Tests failed\n");
	process.exit(1);
}
