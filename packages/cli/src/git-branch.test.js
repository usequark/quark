/**
 * Tests for the branch name the scaffolder initialises.
 *
 * `git init` with no `-b` inherits `init.defaultBranch` from the machine's git
 * config. That setting is unset almost everywhere, and git then falls back to
 * `master` and prints a hint nobody reads. So the same published CLI produced a
 * scaffold on `master` in one terminal and on `main` in another - the scaffold
 * was not reproducible, and neither was the README's `git push -u origin main`.
 *
 * These tests drive the real `initializeGit` through the real CLI binary rather
 * than reimplementing it, because the bug is a git-version-and-config
 * interaction: only running git under a hostile config reproduces it.
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"index.js",
);

/**
 * Git sets `GIT_DIR` (and `GIT_EXEC_PATH`, `GIT_PREFIX`) for every command it
 * runs, which includes hooks. Inherited into a fixture, git resolves the
 * repository from `GIT_DIR` rather than from `cwd`, so a fixture's `git add`
 * would stage into the real repository's index. Strip every `GIT_*` key.
 */
function cleanEnv(extra = {}) {
	const env = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (!key.startsWith("GIT_")) env[key] = value;
	}
	return { ...env, ...extra };
}

/**
 * An empty project directory, plus the global git config that makes the
 * machine choose a branch name.
 *
 * `GIT_CONFIG_GLOBAL` / `GIT_CONFIG_SYSTEM` point git at throwaway files rather
 * than at the developer's real `~/.gitconfig`, so these tests neither read nor
 * modify it. The global config deliberately sets `init.defaultBranch = main`,
 * which is what makes this suite meaningful: with it set, a bare `git init`
 * produces `main` and the bug hides. Only a machine with the setting *unset*
 * exposes it.
 */
function makeHostileGitConfig(dir, defaultBranch) {
	const config = path.join(dir, "gitconfig");
	const lines = [
		"[user]",
		"\tname = Fixture",
		"\temail = fixture@example.test",
	];
	if (defaultBranch !== undefined) {
		lines.push("[init]", `\tdefaultBranch = ${defaultBranch}`);
	}
	writeFileSync(config, `${lines.join("\n")}\n`);
	return config;
}

/** Scaffold a throwaway project and return its directory. */
function scaffold(parentDir, { defaultBranch } = {}) {
	// The CLI creates a subdirectory named after the project, so the
	// repository ends up at `<parentDir>/app`, not `<parentDir>`.
	const target = path.join(parentDir, "app");
	mkdirSync(target, { recursive: true });

	const globalConfig = makeHostileGitConfig(parentDir, defaultBranch);

	const result = spawnSync(
		process.execPath,
		[CLI, "app", "--no-prompts", "--skip-install", "--skip-docker"],
		{
			cwd: target,
			encoding: "utf-8",
			env: cleanEnv({
				GIT_CONFIG_GLOBAL: globalConfig,
				GIT_CONFIG_SYSTEM: path.join(parentDir, "gitconfig-system"),
			}),
			timeout: 120_000,
		},
	);

	return {
		dir: path.join(target, "app"),
		result,
		globalConfig,
		globalConfigBefore: readFileSync(globalConfig, "utf-8"),
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

test("the scaffolder initialises main regardless of init.defaultBranch", () => {
	// The reported case: init.defaultBranch unset, git falls back to master,
	// and the scaffold lands on master.
	const parent = mkdtempSync(path.join(tmpdir(), "quark-branch-"));
	const { dir, result } = scaffold(parent, { defaultBranch: undefined });

	assert.equal(result.status, 0, `scaffold failed:\n${result.stderr}`);

	const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
		cwd: dir,
		encoding: "utf-8",
		env: cleanEnv(),
	}).trim();

	assert.equal(
		branch,
		"main",
		"scaffolds must not inherit the machine's default branch",
	);
});

test("an explicitly configured init.defaultBranch of master is still overridden", () => {
	// The stronger version of the same bug: a machine that has actually
	// configured `master` is not hypothetical, and the scaffolder should not
	// defer to it either.
	const parent = mkdtempSync(path.join(tmpdir(), "quark-branch-"));
	const { dir, result } = scaffold(parent, { defaultBranch: "master" });

	assert.equal(result.status, 0, `scaffold failed:\n${result.stderr}`);

	const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
		cwd: dir,
		encoding: "utf-8",
		env: cleanEnv(),
	}).trim();

	assert.equal(branch, "main");
});

test("the scaffold still produces exactly one initial commit", () => {
	// Guards the branch change against regressing the commit itself.
	const parent = mkdtempSync(path.join(tmpdir(), "quark-branch-"));
	const { dir, result } = scaffold(parent, { defaultBranch: undefined });

	assert.equal(result.status, 0, `scaffold failed:\n${result.stderr}`);

	const log = execFileSync("git", ["log", "--format=%s"], {
		cwd: dir,
		encoding: "utf-8",
		env: cleanEnv(),
	}).trim();

	assert.equal(log.split("\n").length, 1, `expected one commit, got:\n${log}`);
	assert.match(log, /initial commit/i);
});

test("the scaffolder supplies its own identity, not the machine's", () => {
	// Pairs with the branch assertion: the commit must be reproducible on a
	// machine with no global user.name / user.email, which is why
	// initializeGit passes `-c user.email=...` explicitly. The fixture's global
	// config names a different author on purpose.
	const parent = mkdtempSync(path.join(tmpdir(), "quark-branch-"));
	const { dir, result, globalConfig, globalConfigBefore } = scaffold(parent, {
		defaultBranch: undefined,
	});

	assert.equal(result.status, 0, `scaffold failed:\n${result.stderr}`);

	const author = execFileSync("git", ["log", "-1", "--format=%an <%ae>"], {
		cwd: dir,
		encoding: "utf-8",
		env: cleanEnv(),
	}).trim();

	assert.equal(author, "Quark Scaffold <scaffold@quark.local>");
	assert.equal(
		readFileSync(globalConfig, "utf-8"),
		globalConfigBefore,
		"the scaffold must not write to the machine's global git config",
	);
});
