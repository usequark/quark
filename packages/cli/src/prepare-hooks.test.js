#!/usr/bin/env node
/**
 * Tests for the scaffolded project's scripts/prepare.js git hook setup.
 * Run with: node --test packages/cli/src/prepare-hooks.test.js
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
	getGitRoot,
	getHooksDir,
	installScopedHooks,
	main,
	readHookConfig,
} from "../templates/base-project/scripts/prepare.js";

const tempDirs = [];

function makeTempDir() {
	const dir = mkdtempSync(path.join(tmpdir(), "quark-prepare-hooks-"));
	tempDirs.push(dir);
	return dir;
}

after(() => {
	for (const dir of tempDirs) {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// best-effort cleanup
		}
	}
});

function git(args, cwd, opts = {}) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		...opts,
	}).trim();
}

function initRepo(dir) {
	git(["init", "-q"], dir);
	git(["config", "user.email", "test@quark.local"], dir);
	git(["config", "user.name", "Quark Test"], dir);
	return dir;
}

function makeProject(repoRoot, name, hookConfig) {
	const projectDir = path.join(repoRoot, name);
	fs.mkdirSync(path.join(projectDir, "scripts"), { recursive: true });
	fs.writeFileSync(
		path.join(projectDir, "package.json"),
		`${JSON.stringify(
			{
				name: `@test/${name}`,
				private: true,
				scripts: { prepare: "node scripts/prepare.js" },
				"simple-git-hooks": hookConfig,
			},
			null,
			"\t",
		)}\n`,
	);
	return projectDir;
}

function hooksDirFor(repoRoot) {
	return path.join(repoRoot, ".git", "hooks");
}

function scopedHooksDirFor(repoRoot) {
	return path.join(hooksDirFor(repoRoot), "quark-scoped-hooks");
}

function entriesDirFor(repoRoot) {
	return path.join(scopedHooksDirFor(repoRoot), "entries");
}

function entryName(relativeProjectPath, hook) {
	const hash = crypto
		.createHash("sha256")
		.update(relativeProjectPath)
		.digest("hex")
		.slice(0, 16);
	return `${hash}.${hook}`;
}

function readEntry(repoRoot, relativeProjectPath, hook) {
	return JSON.parse(
		fs.readFileSync(
			path.join(entriesDirFor(repoRoot), entryName(relativeProjectPath, hook)),
			"utf8",
		),
	);
}

function writeHook(dir, name, contents) {
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, name), contents);
}

function readHook(dir, name) {
	return fs.readFileSync(path.join(dir, name), "utf8");
}

function silentLogger() {
	return { log() {}, warn() {} };
}

const isExecutable = (file) => (fs.statSync(file).mode & 0o111) !== 0;

describe("prepare.js git context detection", () => {
	it("returns null outside a git repository", () => {
		const dir = makeTempDir();
		assert.equal(getGitRoot(dir), null);
		assert.equal(getHooksDir(dir), null);
	});

	it("finds the enclosing repository for a nested project", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pnpm nano-staged",
		});

		assert.equal(
			fs.realpathSync(getGitRoot(projectDir)),
			fs.realpathSync(repoRoot),
		);
		assert.equal(
			fs.realpathSync(getHooksDir(projectDir)),
			fs.realpathSync(hooksDirFor(repoRoot)),
		);
	});

	it("respects a relative core.hooksPath", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pnpm nano-staged",
		});
		git(["config", "core.hooksPath", ".githooks"], repoRoot);

		assert.equal(
			getHooksDir(projectDir),
			path.join(fs.realpathSync(repoRoot), ".githooks"),
		);
	});
});

describe("scoped hook installation for nested projects", () => {
	it("installs an executable shim, a dispatcher, and a project entry", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pnpm nano-staged",
			"pre-push": "pnpm check:loading && pnpm test",
		});

		const result = installScopedHooks({ projectDir, logger: silentLogger() });
		assert.deepEqual(result.installed.sort(), ["pre-commit", "pre-push"]);
		assert.deepEqual(result.skipped, []);

		const shimPath = path.join(hooksDirFor(repoRoot), "pre-commit");
		const shim = readHook(hooksDirFor(repoRoot), "pre-commit");
		assert.ok(isExecutable(shimPath));
		assert.ok(shim.includes("quark:scoped-git-hook"));
		assert.ok(shim.includes("quark-scoped-hooks/dispatch.js"));
		assert.ok(shim.includes('" pre-commit'));
		assert.ok(
			fs.existsSync(path.join(scopedHooksDirFor(repoRoot), "dispatch.js")),
		);

		assert.deepEqual(readEntry(repoRoot, "my-app", "pre-commit"), {
			project: "my-app",
			command: "pnpm nano-staged",
		});
		assert.deepEqual(readEntry(repoRoot, "my-app", "pre-push"), {
			project: "my-app",
			command: "pnpm check:loading && pnpm test",
		});
	});

	it("is idempotent", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pnpm nano-staged",
		});

		installScopedHooks({ projectDir, logger: silentLogger() });
		const firstShim = readHook(hooksDirFor(repoRoot), "pre-commit");
		const firstDispatcher = fs.readFileSync(
			path.join(scopedHooksDirFor(repoRoot), "dispatch.js"),
			"utf8",
		);

		const result = installScopedHooks({ projectDir, logger: silentLogger() });

		assert.deepEqual(result.installed, ["pre-commit"]);
		assert.equal(readHook(hooksDirFor(repoRoot), "pre-commit"), firstShim);
		assert.equal(
			fs.readFileSync(
				path.join(scopedHooksDirFor(repoRoot), "dispatch.js"),
				"utf8",
			),
			firstDispatcher,
		);
		assert.equal(fs.readdirSync(entriesDirFor(repoRoot)).length, 1);
	});

	it("does not overwrite foreign hooks or remove unrelated hooks", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pnpm nano-staged",
			"pre-push": "pnpm test",
		});
		const hooksDir = hooksDirFor(repoRoot);
		writeHook(hooksDir, "pre-commit", "#!/bin/sh\necho custom hook\n");
		writeHook(hooksDir, "commit-msg", "#!/bin/sh\necho commit-msg\n");

		const result = installScopedHooks({ projectDir, logger: silentLogger() });

		assert.deepEqual(result.installed, ["pre-push"]);
		assert.deepEqual(result.skipped, ["pre-commit"]);
		assert.equal(
			readHook(hooksDir, "pre-commit"),
			"#!/bin/sh\necho custom hook\n",
		);
		assert.equal(
			readHook(hooksDir, "commit-msg"),
			"#!/bin/sh\necho commit-msg\n",
		);
		// The skipped hook must not leave a stale entry behind either.
		assert.equal(
			fs.existsSync(
				path.join(entriesDirFor(repoRoot), entryName("my-app", "pre-commit")),
			),
			false,
		);
	});

	it("replaces hooks previously installed by simple-git-hooks", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pnpm nano-staged",
		});
		const hooksDir = hooksDirFor(repoRoot);
		writeHook(
			hooksDir,
			"pre-commit",
			'#!/bin/sh\nif [ "$SKIP_SIMPLE_GIT_HOOKS" = "1" ]; then\n    exit 0\nfi\npnpm nano-staged',
		);

		const result = installScopedHooks({ projectDir, logger: silentLogger() });

		assert.deepEqual(result.installed, ["pre-commit"]);
		assert.ok(
			readHook(hooksDir, "pre-commit").includes("quark:scoped-git-hook"),
		);
	});

	it("skips installation when the project is at the repository root", () => {
		const repoRoot = initRepo(makeTempDir());
		const hooksDir = hooksDirFor(repoRoot);
		writeHook(hooksDir, "pre-commit", "#!/bin/sh\necho root project\n");
		fs.writeFileSync(
			path.join(repoRoot, "package.json"),
			JSON.stringify({
				"simple-git-hooks": { "pre-commit": "pnpm nano-staged" },
			}),
		);

		const result = installScopedHooks({
			projectDir: repoRoot,
			logger: silentLogger(),
		});

		assert.deepEqual(result.installed, []);
		assert.equal(result.reason, "project-is-git-root");
		assert.equal(
			readHook(hooksDir, "pre-commit"),
			"#!/bin/sh\necho root project\n",
		);
	});

	it("composes hooks from multiple nested projects instead of overwriting", () => {
		const repoRoot = initRepo(makeTempDir());
		const alpha = makeProject(repoRoot, "alpha", {
			"pre-commit": "pwd > .hook-cwd",
		});
		const beta = makeProject(repoRoot, "beta", {
			"pre-commit": "pwd > .hook-cwd",
		});

		installScopedHooks({ projectDir: alpha, logger: silentLogger() });
		const shimAfterAlpha = readHook(hooksDirFor(repoRoot), "pre-commit");
		installScopedHooks({ projectDir: beta, logger: silentLogger() });

		// Installing beta must not replace alpha's registration or the shim.
		assert.equal(readHook(hooksDirFor(repoRoot), "pre-commit"), shimAfterAlpha);
		assert.deepEqual(readEntry(repoRoot, "alpha", "pre-commit"), {
			project: "alpha",
			command: "pwd > .hook-cwd",
		});
		assert.deepEqual(readEntry(repoRoot, "beta", "pre-commit"), {
			project: "beta",
			command: "pwd > .hook-cwd",
		});

		// A commit staged in alpha runs alpha's command only.
		fs.writeFileSync(path.join(alpha, "file.txt"), "alpha\n");
		git(["add", "file.txt"], alpha);
		git(["commit", "-m", "alpha change"], alpha);
		assert.ok(fs.existsSync(path.join(alpha, ".hook-cwd")));
		assert.equal(fs.existsSync(path.join(beta, ".hook-cwd")), false);

		// And a commit staged in beta runs beta's command.
		fs.writeFileSync(path.join(beta, "file.txt"), "beta\n");
		git(["add", "file.txt"], beta);
		git(["commit", "-m", "beta change"], beta);
		assert.ok(fs.existsSync(path.join(beta, ".hook-cwd")));
	});

	it("drops stale entries when a hook is removed from the config", () => {
		const repoRoot = initRepo(makeTempDir());
		const alpha = makeProject(repoRoot, "alpha", {
			"pre-commit": "pwd > .hook-cwd",
			"pre-push": "pwd > .hook-cwd",
		});
		const beta = makeProject(repoRoot, "beta", {
			"pre-commit": "pwd > .hook-cwd",
		});

		installScopedHooks({ projectDir: alpha, logger: silentLogger() });
		installScopedHooks({ projectDir: beta, logger: silentLogger() });

		// alpha no longer configures pre-push.
		fs.writeFileSync(
			path.join(alpha, "package.json"),
			JSON.stringify({
				"simple-git-hooks": { "pre-commit": "pwd > .hook-cwd" },
			}),
		);
		installScopedHooks({ projectDir: alpha, logger: silentLogger() });

		assert.equal(
			fs.existsSync(
				path.join(entriesDirFor(repoRoot), entryName("alpha", "pre-push")),
			),
			false,
		);
		assert.ok(
			fs.existsSync(
				path.join(entriesDirFor(repoRoot), entryName("alpha", "pre-commit")),
			),
		);
		assert.ok(
			fs.existsSync(
				path.join(entriesDirFor(repoRoot), entryName("beta", "pre-commit")),
			),
		);
	});
});

describe("prepare.js main() in a nested repository", () => {
	it("installs scoped hooks when the enclosing repo has no hook config", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pnpm nano-staged",
		});

		main({ projectDir, logger: silentLogger() });

		assert.ok(
			readHook(hooksDirFor(repoRoot), "pre-commit").includes(
				"quark:scoped-git-hook",
			),
		);
	});

	it("does not touch hooks when the enclosing repo manages its own", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pnpm nano-staged",
		});
		fs.writeFileSync(
			path.join(repoRoot, "package.json"),
			JSON.stringify({
				"simple-git-hooks": { "pre-commit": "pnpm nano-staged" },
			}),
		);

		main({ projectDir, logger: silentLogger() });

		assert.equal(
			fs.existsSync(path.join(hooksDirFor(repoRoot), "pre-commit")),
			false,
		);
	});

	it("does nothing when the project is not in a git repository", () => {
		const projectDir = makeProject(makeTempDir(), "my-app", {
			"pre-commit": "pnpm nano-staged",
		});

		main({ projectDir, logger: silentLogger() });

		assert.equal(fs.existsSync(path.join(projectDir, ".git")), false);
	});

	it("delegates to simple-git-hooks when the project is the git root", () => {
		const repoRoot = initRepo(makeTempDir());
		fs.writeFileSync(
			path.join(repoRoot, "package.json"),
			JSON.stringify({
				"simple-git-hooks": { "pre-commit": "pnpm nano-staged" },
			}),
		);

		const binDir = makeTempDir();
		const marker = path.join(binDir, "npx-called");
		fs.writeFileSync(
			path.join(binDir, "npx"),
			`#!/bin/sh\necho "$@" > ${JSON.stringify(marker)}\n`,
		);
		fs.chmodSync(path.join(binDir, "npx"), 0o755);

		const originalPath = process.env.PATH;
		process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;
		try {
			main({ projectDir: repoRoot, logger: silentLogger() });
		} finally {
			process.env.PATH = originalPath;
		}

		assert.equal(fs.readFileSync(marker, "utf8").trim(), "simple-git-hooks");
		assert.equal(
			fs.existsSync(path.join(hooksDirFor(repoRoot), "pre-commit")),
			false,
		);
	});
});

describe("scoped hook execution", () => {
	it("runs the hook command from the project directory", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pwd > .hook-cwd",
		});

		installScopedHooks({ projectDir, logger: silentLogger() });

		fs.writeFileSync(path.join(projectDir, "file.txt"), "hello\n");
		git(["add", "file.txt"], projectDir);
		git(["commit", "-m", "test commit"], projectDir);

		const hookCwd = fs.readFileSync(path.join(projectDir, ".hook-cwd"), "utf8");
		assert.equal(fs.realpathSync(hookCwd.trim()), fs.realpathSync(projectDir));
	});

	it("is a no-op in a checkout without the project directory", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pwd > .hook-cwd",
		});
		installScopedHooks({ projectDir, logger: silentLogger() });

		// Simulate a worktree where the project is not checked out.
		fs.rmSync(projectDir, { recursive: true, force: true });

		fs.writeFileSync(path.join(repoRoot, "README.md"), "root\n");
		git(["add", "README.md"], repoRoot);
		git(["commit", "-m", "root change"], repoRoot);
	});

	it("scopes pre-push to projects affected by the pushed commits", () => {
		const repoRoot = initRepo(makeTempDir());
		const alpha = makeProject(repoRoot, "alpha", {
			"pre-push": "pwd > .hook-cwd",
		});
		const beta = makeProject(repoRoot, "beta", {
			"pre-push": "pwd > .hook-cwd",
		});
		installScopedHooks({ projectDir: alpha, logger: silentLogger() });
		installScopedHooks({ projectDir: beta, logger: silentLogger() });

		git(["add", "-A"], repoRoot);
		git(["commit", "-m", "base"], repoRoot);
		const baseOid = git(["rev-parse", "HEAD"], repoRoot);

		fs.writeFileSync(path.join(alpha, "change.txt"), "alpha\n");
		git(["add", "change.txt"], alpha);
		git(["commit", "-m", "alpha change"], alpha);
		const headOid = git(["rev-parse", "HEAD"], repoRoot);

		const dispatcher = path.join(scopedHooksDirFor(repoRoot), "dispatch.js");
		execFileSync(process.execPath, [dispatcher, "pre-push"], {
			cwd: repoRoot,
			input: `refs/heads/main ${headOid} refs/heads/main ${baseOid}\n`,
		});

		assert.ok(fs.existsSync(path.join(alpha, ".hook-cwd")));
		assert.equal(fs.existsSync(path.join(beta, ".hook-cwd")), false);

		// Pushing a new branch has no remote commit to diff, so every project runs.
		execFileSync(process.execPath, [dispatcher, "pre-push"], {
			cwd: repoRoot,
			input: `refs/heads/new ${headOid} refs/heads/new ${"0".repeat(40)}\n`,
		});
		assert.ok(fs.existsSync(path.join(beta, ".hook-cwd")));
	});
});

describe("readHookConfig", () => {
	it("reads the simple-git-hooks config from package.json", () => {
		const repoRoot = initRepo(makeTempDir());
		const projectDir = makeProject(repoRoot, "my-app", {
			"pre-commit": "pnpm nano-staged",
		});

		assert.deepEqual(readHookConfig(projectDir), {
			"pre-commit": "pnpm nano-staged",
		});
	});

	it("returns null when no config is present", () => {
		const dir = makeTempDir();
		fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({}));
		assert.equal(readHookConfig(dir), null);
	});
});
