#!/usr/bin/env node

/**
 * Extended CLI flag tests for @usequark/quark-create-app
 * Tests the --no-prompts, --packages, --skip-install, and --skip-docker flags.
 * Run with: node packages/cli/test-flags.js
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
function runCLI(args, cwd, env = {}) {
	return spawnSync(process.execPath, [CLI, ...args], {
		cwd,
		encoding: "utf8",
		timeout: 60_000,
		env: { ...process.env, ...env },
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
					"--packages",
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

	it("invalid packages foo,bar exit with code 1 and print Invalid packages", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				[
					"test-app",
					"--no-prompts",
					"--packages",
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
				combined.includes("Invalid packages"),
				`Expected "Invalid packages" in output\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
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
					"--packages",
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

	it("admin is no longer a scaffoldable feature (skills ship instead)", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				[
					"test-admin-app",
					"--no-prompts",
					"--packages",
					"ui,admin",
					"--skip-install",
					"--skip-docker",
				],
				tmpDir,
			);
			assert.strictEqual(result.status, 1);
			assert.ok(result.stderr.includes("Invalid packages: admin"));

			// Default scaffold ships no admin UI but bundles all skills.
			const scaffold = runCLI(
				[
					"test-admin-app",
					"--no-prompts",
					"--packages",
					"ui,jobs",
					"--skip-install",
					"--skip-docker",
				],
				tmpDir,
			);
			assert.strictEqual(scaffold.status, 0);

			const projectDir = join(tmpDir, "test-admin-app");
			assert.ok(!existsSync(join(projectDir, "packages", "admin")));
			assert.ok(
				!existsSync(join(projectDir, "apps", "web", "src", "app", "admin")),
			);
			assert.ok(
				existsSync(
					join(
						projectDir,
						".opencode",
						"skills",
						"admin-dashboard",
						"SKILL.md",
					),
				),
			);
			assert.ok(
				existsSync(
					join(projectDir, ".opencode", "skills", "quark-skills", "SKILL.md"),
				),
			);

			const webPackageJson = JSON.parse(
				readFileSync(join(projectDir, "apps", "web", "package.json"), "utf8"),
			);
			assert.ok(!webPackageJson.dependencies["@test-admin-app/admin"]);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("all skills are bundled regardless of selected features", () => {
		const tmpDir = makeTempDir();
		const projectName = "test-cms-app";
		try {
			const result = runCLI(
				[
					projectName,
					"--no-prompts",
					"--packages",
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

			const projectDir = join(tmpDir, projectName);
			for (const skill of [
				"cms",
				"crm",
				"bookings",
				"ai",
				"admin-dashboard",
				"quark-skills",
			]) {
				assert.ok(
					existsSync(
						join(projectDir, ".opencode", "skills", skill, "SKILL.md"),
					),
					`missing skill: ${skill}`,
				);
			}

			// No vertical starter code is scaffolded.
			assert.ok(!existsSync(join(projectDir, "packages", "cms")));
			assert.ok(
				!existsSync(
					join(projectDir, "apps", "web", "src", "app", "api", "cms"),
				),
			);
			assert.ok(
				!existsSync(join(projectDir, "apps", "web", "src", "app", "api", "ai")),
			);
			assert.ok(
				!existsSync(
					join(projectDir, "apps", "web", "src", "app", "api", "admin", "crm"),
				),
			);

			// No workspace dep on a cms package.
			const webPackageJson = JSON.parse(
				readFileSync(join(projectDir, "apps", "web", "package.json"), "utf8"),
			);
			assert.ok(!webPackageJson.dependencies["@test-cms-app/cms"]);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("add cms exits with unknown-feature error (skills are always bundled)", () => {
		const tmpDir = makeTempDir();
		const projectName = "test-add-admin-app";
		try {
			const createResult = runCLI(
				[
					projectName,
					"--no-prompts",
					"--packages",
					"ui",
					"--skip-install",
					"--skip-docker",
				],
				tmpDir,
			);
			assert.strictEqual(createResult.status, 0);

			const projectDir = join(tmpDir, projectName);
			const addResult = runCLI(["add", "cms", "--skip-install"], projectDir);
			assert.strictEqual(addResult.status, 1);
			assert.ok(addResult.stderr.includes('Unknown feature: "cms"'));

			// The bundled skill is still present for the AI to use on demand.
			assert.ok(
				existsSync(join(projectDir, ".opencode", "skills", "cms", "SKILL.md")),
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
					"--packages",
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
					"--packages",
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

describe("Signup Configuration", () => {
	it("writes AUTH_ALLOW_SIGNUP=false when scaffolded with signup disabled", () => {
		const tmpDir = makeTempDir();
		const projectName = "test-no-signup-app";
		try {
			const result = runCLI(
				[
					projectName,
					"--no-prompts",
					"--signup",
					"disabled",
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
			const envExample = readFileSync(join(projectDir, ".env.example"), "utf8");
			const env = readFileSync(join(projectDir, ".env"), "utf8");
			const quarkLink = JSON.parse(
				readFileSync(join(projectDir, ".quark-link.json"), "utf8"),
			);

			assert.ok(envExample.includes("AUTH_ALLOW_SIGNUP=false"));
			assert.ok(env.includes("AUTH_ALLOW_SIGNUP=false"));
			assert.strictEqual(quarkLink.authAllowSignup, false);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("writes AUTH_ALLOW_SIGNUP=true by default in non-interactive scaffolds", () => {
		const tmpDir = makeTempDir();
		const projectName = "test-signup-default-app";
		try {
			const result = runCLI(
				[projectName, "--no-prompts", "--skip-install", "--skip-docker"],
				tmpDir,
			);
			assert.strictEqual(
				result.status,
				0,
				`Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);

			const projectDir = join(tmpDir, projectName);
			const env = readFileSync(join(projectDir, ".env"), "utf8");
			assert.ok(env.includes("AUTH_ALLOW_SIGNUP=true"));
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
	it("--no-prompts reports the default package selection", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(
				["test-app", "--no-prompts", "--skip-install", "--skip-docker"],
				tmpDir,
			);
			assert.ok(
				result.stdout.includes(
					"Using default packages: ui, jobs (non-interactive mode)",
				),
				`Expected default package summary in stdout\nstdout: ${result.stdout}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("--no-prompts omits the interactive prompts", () => {
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

// ---------------------------------------------------------------------------
// Test Group 4: AI View params (--prompt)
// ---------------------------------------------------------------------------

describe("AI View Params", () => {
	it("--prompt seeds the brief in .quark-link.json", () => {
		const tmpDir = makeTempDir();
		const projectName = "test-prompt-app";
		try {
			const result = runCLI(
				[
					projectName,
					"--no-prompts",
					"--packages",
					"ui",
					"--prompt",
					"A booking platform for salons",
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
			const quarkLink = JSON.parse(
				readFileSync(join(tmpDir, projectName, ".quark-link.json"), "utf8"),
			);
			assert.strictEqual(quarkLink.brief, "A booking platform for salons");
		} finally {
			cleanup(tmpDir);
		}
	});
});

// ---------------------------------------------------------------------------
// Test Group 5: skill command
// ---------------------------------------------------------------------------

describe("skill command", () => {
	it("skill bookings prints the bookings skill", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(["skill", "bookings"], tmpDir);
			assert.strictEqual(
				result.status,
				0,
				`Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
			assert.ok(result.stdout.includes("Bookings Skill"));
			assert.ok(result.stdout.includes("reference/verticals/bookings"));
		} finally {
			cleanup(tmpDir);
		}
	});

	it("skill model prints the add-model skill", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(["skill", "model"], tmpDir);
			assert.strictEqual(
				result.status,
				0,
				`Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
			assert.ok(result.stdout.includes("Add a new Prisma model"));
		} finally {
			cleanup(tmpDir);
		}
	});

	it("skill with unknown feature exits with code 1", () => {
		const tmpDir = makeTempDir();
		try {
			const result = runCLI(["skill", "nope"], tmpDir);
			assert.strictEqual(result.status, 1);
			assert.ok((result.stdout + result.stderr).includes("No skill found"));
		} finally {
			cleanup(tmpDir);
		}
	});
});

// ---------------------------------------------------------------------------
// Test Group 6: scaffolding inside an existing git repository
// ---------------------------------------------------------------------------

describe("Existing git repository", () => {
	it("does not create a nested repo when scaffolded inside one", () => {
		const tmpDir = makeTempDir();
		try {
			execFileSync("git", ["init", "-q"], { cwd: tmpDir });

			const result = runCLI(
				[
					"nested-app",
					"--no-prompts",
					"--packages",
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
			assert.ok(
				!existsSync(join(tmpDir, "nested-app", ".git")),
				"scaffold must not create a nested .git directory",
			);
			assert.ok(
				(result.stdout + result.stderr).includes(
					"Already inside a git repository",
				),
				`Expected existing-repo notice\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
		} finally {
			cleanup(tmpDir);
		}
	});

	it("creates a nested repo when QUARK_FORCE_GIT_INIT=true", () => {
		const tmpDir = makeTempDir();
		try {
			execFileSync("git", ["init", "-q"], { cwd: tmpDir });

			const result = runCLI(
				[
					"nested-app",
					"--no-prompts",
					"--packages",
					"ui",
					"--skip-install",
					"--skip-docker",
				],
				tmpDir,
				{ QUARK_FORCE_GIT_INIT: "true" },
			);

			assert.strictEqual(
				result.status,
				0,
				`Expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
			assert.ok(
				existsSync(join(tmpDir, "nested-app", ".git")),
				"forced scaffold must create a nested .git directory",
			);
		} finally {
			cleanup(tmpDir);
		}
	});
});
