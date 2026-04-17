#!/usr/bin/env node
/**
 * Build verification test for @techstream/quark-create-app CLI
 * Runs: scaffold -> install -> build
 *
 * Enable with: QUARK_CLI_BUILD_TEST=1 node test-build.js
 */

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(tmpdir(), "quark-cli-build-test");
const projectName = "cli-build-test-app";
const projectPath = path.join(testDir, projectName);

if (!process.env.QUARK_CLI_BUILD_TEST) {
	console.log("⏭️  Skipping build test (set QUARK_CLI_BUILD_TEST=1 to run)");
	process.exit(0);
}

await fs.remove(testDir);
await fs.ensureDir(testDir);

console.log("🧪 Build Test: Scaffold -> Install -> Build\n");

try {
	console.log("📦 Scaffolding project...");
	const cliPath = path.join(__dirname, "src/index.js");
	const proc = spawn("node", [cliPath, projectName], {
		cwd: testDir,
		stdio: ["pipe", "pipe", "pipe"],
	});

	let _output = "";
	let responded = false;

	proc.stdout.on("data", (data) => {
		const str = data.toString();
		_output += str;
		process.stdout.write(str);

		if (!responded && str.includes("Which optional packages")) {
			responded = true;
			proc.stdin.write("\n");
		}
	});

	proc.stderr.on("data", (data) => {
		const str = data.toString();
		_output += str;
		process.stderr.write(str);
	});

	const exitCode = await new Promise((resolve) => {
		proc.on("close", (code) => resolve(code));
	});

	if (exitCode !== 0) {
		throw new Error(`CLI exited with code ${exitCode}`);
	}

	if (!(await fs.pathExists(projectPath))) {
		throw new Error("Project directory not created");
	}

	console.log("\n✅ Project scaffolded successfully\n");
	console.log("🏗️  Running build...\n");

	await execa("pnpm", ["build"], {
		cwd: projectPath,
		stdio: "inherit",
	});

	console.log("\n✅ Build completed successfully\n");
} catch (error) {
	console.error("\n❌ Build test failed:\n");
	console.error(error.message || error);
	process.exit(1);
} finally {
	await fs.remove(testDir);
}
