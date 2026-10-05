#!/usr/bin/env node

/**
 * Tests for the uncommitted-changes guard in `quark add` / `quark update`.
 *
 * The guard must be scoped to the Quark project directory so that a project
 * nested inside a larger repository is not blocked by dirty sibling files
 * elsewhere in that repository.
 *
 * Run with: node --test packages/cli/src/scaffold-guards.test.js
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const CLI = path.join(import.meta.dirname, "index.js");
const PROJECT_NAME = "guard-app";

let tempRoot;
let fixtureRepo;
let scaffoldResult;

function git(args, cwd) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function runCLI(args, cwd) {
	return spawnSync(process.execPath, [CLI, ...args], {
		cwd,
		encoding: "utf8",
		timeout: 120_000,
	});
}

function copyFixture() {
	const dir = mkdtempSync(path.join(tempRoot, "case-"));
	fs.cpSync(fixtureRepo, dir, { recursive: true });
	return dir;
}

before(() => {
	tempRoot = mkdtempSync(path.join(tmpdir(), "quark-scaffold-guards-"));
	fixtureRepo = path.join(tempRoot, "fixture");
	fs.mkdirSync(fixtureRepo, { recursive: true });

	git(["init", "-q"], fixtureRepo);
	// git auto-gc runs in the background after a commit and prunes loose object
	// directories. copyFixture() then walks .git/objects while that prune is
	// still in flight, which surfaces as a C++ filesystem_error from cpSync:
	// "No such file or directory [.../fixture/.git/objects/3b]". The failure is
	// a race in the harness, not an assertion, and it lands on whichever test
	// happens to copy while the prune runs.
	//
	// It became common rather than rare once the scaffolder started writing a
	// .gitignore: fewer files reach `git add`, so the object layout and the
	// timing of the prune both shift. 3/10 failures before, 8/10 after.
	git(["config", "gc.auto", "0"], fixtureRepo);
	git(["config", "user.email", "test@quark.local"], fixtureRepo);
	git(["config", "user.name", "Quark Test"], fixtureRepo);
	fs.writeFileSync(path.join(fixtureRepo, "sibling.txt"), "sibling\n");
	git(["add", "."], fixtureRepo);
	git(["commit", "-q", "-m", "fixture"], fixtureRepo);

	const result = runCLI(
		[
			PROJECT_NAME,
			"--no-prompts",
			"--packages",
			"",
			"--skip-install",
			"--skip-docker",
		],
		fixtureRepo,
	);
	scaffoldResult = result;
	assert.strictEqual(
		result.status,
		0,
		`scaffold failed\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
	);

	git(["add", PROJECT_NAME], fixtureRepo);
	git(["commit", "-q", "-m", "scaffold"], fixtureRepo);
});

after(() => {
	if (tempRoot) {
		rmSync(tempRoot, { recursive: true, force: true });
	}
});

describe("uncommitted-changes guard", () => {
	it("warns that nested workflows are ignored by GitHub", () => {
		assert.match(
			scaffoldResult.stdout + scaffoldResult.stderr,
			/GitHub only runs workflows stored at the repository root/,
		);
	});

	it("ignores dirty sibling files in the enclosing repository", () => {
		const repo = copyFixture();
		fs.appendFileSync(path.join(repo, "sibling.txt"), "dirty sibling\n");

		const result = runCLI(
			["add", "jobs", "--skip-install"],
			path.join(repo, PROJECT_NAME),
		);

		assert.strictEqual(
			result.status,
			0,
			`dirty sibling must not block the nested project\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
		);
	});

	it("blocks when the project has unstaged changes", () => {
		const repo = copyFixture();
		fs.appendFileSync(
			path.join(repo, PROJECT_NAME, "README.md"),
			"\nlocal edit\n",
		);

		const result = runCLI(
			["add", "jobs", "--skip-install"],
			path.join(repo, PROJECT_NAME),
		);

		assert.strictEqual(result.status, 1);
		assert.match(result.stdout + result.stderr, /uncommitted changes/);
	});

	it("blocks when the project has staged changes", () => {
		const repo = copyFixture();
		const projectDir = path.join(repo, PROJECT_NAME);
		fs.appendFileSync(path.join(projectDir, "README.md"), "\nstaged edit\n");
		git(["add", "README.md"], projectDir);

		const result = runCLI(["add", "jobs", "--skip-install"], projectDir);

		assert.strictEqual(result.status, 1);
		assert.match(result.stdout + result.stderr, /uncommitted changes/);
	});
});
