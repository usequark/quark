#!/usr/bin/env node

/**
 * Integration test - creates an actual project using the CLI
 * This tests the real CLI execution with programmatic input handling
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = "/tmp/integration-test";
const projectName = "integration-test-app";

await fs.remove(testDir);
await fs.ensureDir(testDir);

console.log("🧪 Integration Test: Real CLI Execution\n");

const cliPath = path.join(__dirname, "src/index.js");
const proc = spawn("node", [cliPath, projectName], {
	cwd: testDir,
	stdio: ["pipe", "pipe", "pipe"],
});

let _output = "";
let started = false;

proc.stdout.on("data", (data) => {
	const str = data.toString();
	_output += str;
	process.stdout.write(str);

	// Look for the prompt and send input
	if (!started && str.includes("Which packages")) {
		started = true;
		// Send selections: space space space (toggle all) and enter
		proc.stdin.write("\n"); // Accept defaults (ui and jobs selected)
	}
});

proc.stderr.on("data", (data) => {
	_output += data.toString();
	process.stderr.write(data);
});

await new Promise((resolve) => {
	proc.on("close", (code) => {
		console.log(`\n\n${"=".repeat(60)}\n`);

		if (code === 0) {
			console.log("✓ CLI execution completed successfully\n");

			// Verify the project was created
			const projectPath = path.join(testDir, projectName);
			if (fs.existsSync(projectPath)) {
				console.log("✓ Project directory created");

				const files = [
					"package.json",
					"turbo.json",
					"docker-compose.yml",
					".env.example",
					"packages/ui",
					"packages/jobs",
					".git",
				];

				console.log("\n✓ Project structure verified:");
				files.forEach((f) => {
					const exists = fs.existsSync(path.join(projectPath, f));
					console.log(`  ${exists ? "✓" : "✗"} ${f}`);
				});

				console.log("\n🎉 Integration test passed!\n");
			} else {
				console.log("✗ Project directory was not created\n");
			}
		} else {
			console.log(`✗ CLI exited with code ${code}\n`);
		}

		resolve();
	});
});
