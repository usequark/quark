#!/usr/bin/env node

/**
 * Extended CLI flag tests for @techstream/quark-create-app
 * Tests the --no-prompts, --features, --skip-install, and --skip-docker flags.
 * Run with: node packages/cli/test-flags.js
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, "src/index.js");

/**
 * Run the CLI synchronously and return the result.
 * Uses `process.execPath` to ensure the same Node.js binary is used.
 */
function runCLI(args, cwd) {
	return spawnSync(process.execPath, [CLI, ...args], {
		cwd,
		encoding: "utf8",
		timeout: 60_000,
	});
}

/** Create a unique temp directory for an isolated test run. */
function makeTempDir() {
	return mkdtempSync(join(tmpdir(), "test-flags-"));
}

/** Remove a temp directory, ignoring errors. */
function cleanup(dir) {
	try {
		rmSync(dir, { recursive: true, force: true });
	} catch {
		// best-effort cleanup
	}
}

// ---------------------------------------------------------------------------
// Test Group 1: Feature Validation
// ---------------------------------------------------------------------------

describe("Feature Validation", () => {
	it("valid features ui,jobs succeed", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				[
					"test-app",
					"--no-prompts",
					"--features",
					"ui,jobs",
					"--skip-install",
					"--skip-docker",
				],
				tmpDir,
			);
			assert.strictEqual(
				result.status,
				0,
				`Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("invalid features foo,bar exit with code 1 and print Invalid features", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				[
					"test-app",
					"--no-prompts",
					"--features",
					"foo,bar",
					"--skip-install",
					"--skip-docker",
				],
				tmpDir,
			);
			assert.strictEqual(
				result.status,
				1,
				`Expected exit 1\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
			const combined = result.stdout + result.stderr;
			assert.ok(
				combined.includes("Invalid features"),
				`Expected "Invalid features" in output\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("single valid feature ui succeeds", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				[
					"test-app",
					"--no-prompts",
					"--features",
					"ui",
					"--skip-install",
					"--skip-docker",
				],
				tmpDir,
			);
			assert.strictEqual(
				result.status,
				0,
				`Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("empty features string succeeds (minimal setup)", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				[
					"test-app",
					"--no-prompts",
					"--features",
					"",
					"--skip-install",
					"--skip-docker",
				],
				tmpDir,
			);
			assert.strictEqual(
				result.status,
				0,
				`Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("mixed valid and invalid features exits with code 1", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				[
					"test-app",
					"--no-prompts",
					"--features",
					"ui,invalid",
					"--skip-install",
					"--skip-docker",
				],
				tmpDir,
			);
			assert.strictEqual(
				result.status,
				1,
				`Expected exit 1\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});
});

// ---------------------------------------------------------------------------
// Test Group 2: Skip Flags
// ---------------------------------------------------------------------------

describe("Skip Flags", () => {
	it("--skip-install creates project without node_modules", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				["test-app", "--no-prompts", "--skip-install", "--skip-docker"],
				tmpDir,
			);
			assert.strictEqual(
				result.status,
				0,
				`Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
			const nodeModulesPath = join(tmpDir, "test-app", "node_modules");
			assert.ok(
				!existsSync(nodeModulesPath),
				"Expected node_modules to be absent when --skip-install is used",
			);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("--skip-docker runs successfully without requiring Docker", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				["test-app", "--no-prompts", "--skip-docker", "--skip-install"],
				tmpDir,
			);
			assert.strictEqual(
				result.status,
				0,
				`Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});
});

// ---------------------------------------------------------------------------
// Test Group 3: Non-Interactive Mode
// ---------------------------------------------------------------------------

describe("Non-Interactive Mode", () => {
	it('--no-prompts outputs "Running in non-interactive mode"', () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				["test-app", "--no-prompts", "--skip-install", "--skip-docker"],
				tmpDir,
			);
			assert.ok(
				result.stdout.includes("Running in non-interactive mode"),
				`Expected "Running in non-interactive mode" in stdout\nstdout: ${result.stdout}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});

	it('--no-prompts outputs "Features: ui,jobs" (default features)', () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				["test-app", "--no-prompts", "--skip-install", "--skip-docker"],
				tmpDir,
			);
			assert.ok(
				result.stdout.includes("Features: ui,jobs"),
				`Expected "Features: ui,jobs" in stdout\nstdout: ${result.stdout}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});
});
