#!/usr/bin/env node

/**
 * Extended CLI flag tests for @techstream/quark-create-app
 * Tests the --no-prompts, --features, --skip-install, and --skip-docker flags.
 * Run with: node packages/cli/test-flags.js
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

	it("admin feature scaffolds admin without CMS package or routes", () => {
		const tmpDir = makeTempDir();
		const projectName = "test-admin-app";
		try {
			const result = runCLI(
				[
					projectName,
					"--no-prompts",
					"--features",
					"ui,admin",
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

			const projectDir = join(tmpDir, projectName);
			assert.ok(existsSync(join(projectDir, "packages", "admin")));
			assert.ok(!existsSync(join(projectDir, "packages", "cms")));
			assert.ok(
				!existsSync(
					join(
						projectDir,
						"apps",
						"web",
						"src",
						"app",
						"admin",
						"cms",
						"page.js",
					),
				),
			);

			const webPackageJson = JSON.parse(
				readFileSync(join(projectDir, "apps", "web", "package.json"), "utf8"),
			);
			assert.ok(!webPackageJson.dependencies[`@test-admin-app/cms`]);

			const adminLayout = readFileSync(
				join(projectDir, "apps", "web", "src", "app", "admin", "layout.js"),
				"utf8",
			);
			assert.ok(adminLayout.includes("loadCmsConfig"));
			assert.ok(!adminLayout.includes("@techstream/quark-cms"));

			const nextConfig = readFileSync(
				join(projectDir, "apps", "web", "next.config.js"),
				"utf8",
			);
			assert.ok(!nextConfig.includes("@test-admin-app/cms"));
		} finally {
			cleanup(tmpDir);
		}
	});

	it("cms feature auto-adds admin and ui and scaffolds CMS package and routes", () => {
		const tmpDir = makeTempDir();
		const projectName = "test-cms-app";
		const scope = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "");
		try {
			const result = runCLI(
				[
					projectName,
					"--no-prompts",
					"--features",
					"cms",
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

			const projectDir = join(tmpDir, projectName);
			assert.ok(existsSync(join(projectDir, "packages", "admin")));
			assert.ok(existsSync(join(projectDir, "packages", "cms")));
			assert.ok(
				existsSync(
					join(
						projectDir,
						"apps",
						"web",
						"src",
						"app",
						"admin",
						"cms",
						"page.js",
					),
				),
			);

			const webPackageJson = JSON.parse(
				readFileSync(join(projectDir, "apps", "web", "package.json"), "utf8"),
			);
			const cmsPackageJson = JSON.parse(
				readFileSync(
					join(projectDir, "packages", "cms", "package.json"),
					"utf8",
				),
			);
			assert.strictEqual(cmsPackageJson.name, `@${scope}/cms`);
			assert.strictEqual(
				cmsPackageJson.dependencies[`@${scope}/admin`],
				"workspace:*",
			);
			assert.ok(!cmsPackageJson.dependencies["@techstream/quark-admin"]);
			assert.strictEqual(
				webPackageJson.dependencies[`@${scope}/admin`],
				"workspace:*",
			);
			assert.strictEqual(
				webPackageJson.dependencies[`@${scope}/cms`],
				"workspace:*",
			);
			assert.strictEqual(
				webPackageJson.dependencies[`@${scope}/ui`],
				"workspace:*",
			);

			const nextConfig = readFileSync(
				join(projectDir, "apps", "web", "next.config.js"),
				"utf8",
			);
			assert.ok(nextConfig.includes(`@${scope}/cms`));
		} finally {
			cleanup(tmpDir);
		}
	});

	it("add cms rewrites CMS workspace dependencies and auto-adds admin", () => {
		const tmpDir = makeTempDir();
		const projectName = "test-add-admin-app";
		const scope = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "");
		try {
			const createResult = runCLI(
				[
					projectName,
					"--no-prompts",
					"--features",
					"ui",
					"--skip-install",
					"--skip-docker",
				],
				tmpDir,
			);
			assert.strictEqual(
				createResult.status,
				0,
				`Expected exit 0\nstdout: ${createResult.stdout}\nstderr: ${createResult.stderr}`,
			);

			const projectDir = join(tmpDir, projectName);
			const addResult = runCLI(["add", "cms"], projectDir);
			assert.strictEqual(
				addResult.status,
				0,
				`Expected exit 0\nstdout: ${addResult.stdout}\nstderr: ${addResult.stderr}`,
			);
			assert.ok(existsSync(join(projectDir, "packages", "admin")));

			const cmsPackageJson = JSON.parse(
				readFileSync(
					join(projectDir, "packages", "cms", "package.json"),
					"utf8",
				),
			);
			assert.strictEqual(
				cmsPackageJson.dependencies[`@${scope}/admin`],
				"workspace:*",
			);
			assert.ok(!cmsPackageJson.dependencies["@techstream/quark-admin"]);

			const webPackageJson = JSON.parse(
				readFileSync(join(projectDir, "apps", "web", "package.json"), "utf8"),
			);
			assert.strictEqual(
				webPackageJson.dependencies[`@${scope}/admin`],
				"workspace:*",
			);
			assert.strictEqual(
				webPackageJson.dependencies[`@${scope}/cms`],
				"workspace:*",
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
	it("--no-prompts reports the default feature selection", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				["test-app", "--no-prompts", "--skip-install", "--skip-docker"],
				tmpDir,
			);
			assert.ok(
				result.stdout.includes(
					"Using default features: ui, jobs (non-interactive mode)",
				),
				`Expected default feature summary in stdout\nstdout: ${result.stdout}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("--no-prompts omits the interactive package prompt", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				["test-app", "--no-prompts", "--skip-install", "--skip-docker"],
				tmpDir,
			);
			assert.ok(!result.stdout.includes("Which optional packages"));
		} finally {
			cleanup(tmpDir);
		}
	});
});
