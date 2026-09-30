/**
 * Tests for scripts/check-release-published.mjs.
 *
 * This script is the gate between "a release happened" and "nothing happened",
 * and it has been the site of three real incidents:
 *
 *   1. It reported a release for a version npm had never received, because a
 *      release PR *regeneration* looks identical to a publish in HEAD~1..HEAD.
 *   2. It then silently reported `released=false` on a genuine publish, because
 *      actions/checkout defaults to fetch-depth: 1 and `git show HEAD~1` fails
 *      in a shallow clone. Nothing errored; the step just did nothing.
 *   3. Its comments asserted behaviour that CI contradicted.
 *
 * Each of those is a decision this script makes, so each is asserted here. The
 * script is a top-level side-effecting script with no exports, so every test
 * runs it as a subprocess against a throwaway git repository.
 *
 * The script resolves the repo root from its own `__dirname`, so the script
 * itself is COPIED into the fixture. Running the real file in place would read
 * the real repository and quietly pass every case.
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"check-release-published.mjs",
);

const CORE = { name: "@quark-release-fixture/core", version: "1.0.0" };
const CLI = { name: "@quark-release-fixture/cli", version: "1.0.0" };

/** A git repo shaped like this one, with no history yet. */
function makeFixture() {
	const dir = mkdtempSync(path.join(tmpdir(), "release-guard-"));
	const git = (...args) =>
		execFileSync("git", args, { cwd: dir, stdio: "pipe" });

	git("init", "--quiet", "--initial-branch", "main");
	git("config", "user.email", "fixture@example.test");
	git("config", "user.name", "Fixture");

	mkdirSync(path.join(dir, "scripts"), { recursive: true });
	mkdirSync(path.join(dir, ".changeset"), { recursive: true });
	for (const [key, value] of [
		["core", CORE],
		["cli", CLI],
	]) {
		mkdirSync(path.join(dir, "packages", key), { recursive: true });
		writeFileSync(
			path.join(dir, "packages", key, "package.json"),
			`${JSON.stringify(value, null, 2)}\n`,
		);
	}
	writeFileSync(
		path.join(dir, ".changeset", "config.json"),
		`${JSON.stringify({ $schema: "https://unpkg.com/@changesets/config@3.0.0/schema.json" }, null, 2)}\n`,
	);
	copyFileSync(
		SCRIPT,
		path.join(dir, "scripts", "check-release-published.mjs"),
	);

	return dir;
}

function setVersion(dir, key, version) {
	const file = path.join(dir, "packages", key, "package.json");
	const pkg = JSON.parse(readFileSync(file, "utf-8"));
	writeFileSync(file, `${JSON.stringify({ ...pkg, version }, null, 2)}\n`);
}

function commit(dir, message) {
	const git = (...args) =>
		execFileSync("git", args, { cwd: dir, stdio: "pipe" });
	git("add", "--all");
	git("commit", "--quiet", "--allow-empty", "-m", message);
}

/** Run the guard in `dir` and parse the workflow outputs it wrote. */
function run(dir, { offline = true } = {}) {
	const outputFile = path.join(dir, "github-output");
	const result = spawnSync(
		process.execPath,
		["scripts/check-release-published.mjs"],
		{
			cwd: dir,
			encoding: "utf-8",
			env: {
				...process.env,
				GITHUB_OUTPUT: outputFile,
				// The squash path shells out to `npm view`. These fixture package
				// names do not exist, and offline makes that fail immediately
				// instead of adding a network round trip to the test suite.
				...(offline ? { npm_config_offline: "true" } : {}),
			},
		},
	);

	const raw = readFileSync(outputFile, "utf-8");
	const outputs = {};
	for (const line of raw.split("\n")) {
		const at = line.indexOf("=");
		if (at > 0) outputs[line.slice(0, at)] = line.slice(at + 1);
	}

	return {
		code: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
		outputs,
		published: JSON.parse(outputs.published ?? "[]"),
	};
}

/** A repo whose last commit is a correctly merged release of `bumped`. */
function releasedFixture(bumped = ["cli"], fromVersion = "1.0.0") {
	const dir = makeFixture();
	commit(dir, "chore: something");
	for (const key of bumped) setVersion(dir, key, "1.1.0");
	commit(dir, `Merge pull request #42 from fixture/changeset-release/main`);
	// `fromVersion` is only meaningful for the negative case where nothing
	// changed; recorded here so the intent stays visible at the call site.
	void fromVersion;
	return dir;
}

test("a merge of changeset-release/main with a bumped version is a publish", () => {
	const result = run(releasedFixture());

	assert.equal(result.code, 0);
	assert.equal(result.outputs.released, "true");
	assert.deepEqual(result.published, [{ name: CLI.name, version: "1.1.0" }]);
	assert.match(result.stdout, /Release run: .*@1\.1\.0/);
});

test("a core-only bump still reports as a publish", () => {
	const result = run(releasedFixture(["core"]));

	assert.equal(result.outputs.released, "true");
	assert.deepEqual(result.published, [{ name: CORE.name, version: "1.1.0" }]);
});

test("both packages bumping is reported as one publish, not two", () => {
	const result = run(releasedFixture(["core", "cli"]));

	assert.equal(result.outputs.released, "true");
	assert.equal(result.published.length, 2);
	assert.deepEqual(
		result.published.map((p) => p.version),
		["1.1.0", "1.1.0"],
	);
});

test("a release PR regeneration is not a publish", () => {
	// The 2026-09-29 incident: changesets commits the version bump straight to
	// changeset-release/main, so HEAD~1..HEAD is byte-for-byte what a publish
	// looks like. Only the commit message tells them apart.
	const dir = makeFixture();
	commit(dir, "chore: something");
	setVersion(dir, "cli", "1.1.0");
	commit(dir, "chore: version packages");

	const result = run(dir);

	assert.equal(result.code, 0);
	assert.equal(result.outputs.released, "false");
	assert.deepEqual(result.published, []);
	assert.match(result.stdout, /regeneration, not a publish/);
});

test("a squash-merged release fails the run and reports nothing published", () => {
	const dir = makeFixture();
	commit(dir, "chore: something");
	setVersion(dir, "cli", "1.1.0");
	commit(dir, "chore: version packages (#42)");

	const result = run(dir);

	assert.equal(result.code, 1);
	assert.equal(result.outputs.released, "false");
	assert.deepEqual(result.published, []);
	assert.match(result.stderr, /squash merge/);
	assert.match(result.stderr, /--merge/);
});

test("a release merge with no version change is not a publish", () => {
	const dir = makeFixture();
	commit(dir, "chore: something");
	commit(dir, "Merge pull request #42 from fixture/changeset-release/main");

	const result = run(dir);

	assert.equal(result.code, 0);
	assert.equal(result.outputs.released, "false");
	assert.deepEqual(result.published, []);
});

test("an ordinary commit is not a publish", () => {
	const dir = makeFixture();
	commit(dir, "chore: something");

	assert.equal(run(dir).outputs.released, "false");
});

test("both outputs are written on every path, so no caller reads an empty string", () => {
	// The downstream `if: steps.release-guard.outputs.released == 'true'`
	// silently skips on an empty string, which is indistinguishable from a
	// correct skip. Both keys must always be present.
	for (const dir of [
		releasedFixture(),
		releasedFixture(["core"]),
		(() => {
			const d = makeFixture();
			commit(d, "chore: something");
			return d;
		})(),
	]) {
		const { outputs } = run(dir);
		assert.ok("released" in outputs, "released must always be written");
		assert.ok("published" in outputs, "published must always be written");
	}
});

test("published is valid single-line JSON", () => {
	// It is spliced into a $GITHUB_OUTPUT file, so a newline would truncate it
	// and the step that parses it would throw on an empty string.
	const raw = run(releasedFixture(["core", "cli"])).outputs.published;

	assert.ok(!raw.includes("\n"), "published must be a single line");
	assert.equal(typeof JSON.parse(raw), "object");
});

test("an unreadable HEAD~1 warns and is never reported as a publish", () => {
	// The shallow-clone incident. actions/checkout defaults to fetch-depth: 1,
	// so `git show HEAD~1:...` fails, `advanced` is empty, and the script used
	// to report "nothing happened" with no error anywhere. A single-commit
	// fixture reproduces the same condition without needing a shallow clone.
	const dir = makeFixture();
	setVersion(dir, "cli", "1.1.0");
	commit(dir, "Merge pull request #42 from fixture/changeset-release/main");

	const result = run(dir);

	assert.equal(result.code, 0);
	assert.equal(result.outputs.released, "false");
	const noise = `${result.stdout}${result.stderr}`;
	assert.match(noise, /Could not read the previous version/);
	// It must name the package it could not read, not just say "something".
	assert.ok(noise.includes(CLI.name), "the warning must name the package");
	assert.match(noise, /fetch-depth/);
});

test("a repository that ignores a package keeps it out of the publish list", () => {
	const dir = makeFixture();
	writeFileSync(
		path.join(dir, ".changeset", "config.json"),
		`${JSON.stringify({ ignore: [CLI.name] }, null, 2)}\n`,
	);
	commit(dir, "chore: something");
	setVersion(dir, "cli", "1.1.0");
	setVersion(dir, "core", "1.1.0");
	commit(dir, "Merge pull request #42 from fixture/changeset-release/main");

	const result = run(dir);

	assert.deepEqual(result.published, [{ name: CORE.name, version: "1.1.0" }]);
});

test("outside a git repository the guard is a no-op, not a crash", () => {
	const dir = mkdtempSync(path.join(tmpdir(), "release-guard-nogit-"));
	mkdirSync(path.join(dir, "scripts"), { recursive: true });
	copyFileSync(
		SCRIPT,
		path.join(dir, "scripts", "check-release-published.mjs"),
	);

	const result = spawnSync(
		process.execPath,
		["scripts/check-release-published.mjs"],
		{
			cwd: dir,
			encoding: "utf-8",
			env: { ...process.env, GITHUB_OUTPUT: path.join(dir, "out") },
		},
	);

	assert.equal(result.status, 0);
	assert.match(result.stdout, /Not a git repository/);
});

test("the release-merge discriminator is load-bearing", () => {
	// Guards against the guard. Removing `isReleaseMerge` looks harmless and
	// reintroduces the 2026-09-29 false positive exactly, so assert that the
	// mutated script really does regress.
	const dir = makeFixture();
	commit(dir, "chore: something");
	setVersion(dir, "cli", "1.1.0");
	commit(dir, "chore: version packages");

	// A copy with the discriminator deleted.
	const mutated = path.join(dir, "scripts", "no-discriminator.mjs");
	const source = readFileSync(SCRIPT, "utf-8").replace(
		"const released = advanced.length > 0 && isReleaseMerge;",
		"const released = advanced.length > 0;",
	);
	assert.notEqual(source, readFileSync(SCRIPT, "utf-8"), "mutation applied");
	writeFileSync(mutated, source);

	const outputFile = path.join(dir, "github-output-mutated");
	const result = spawnSync(process.execPath, ["scripts/no-discriminator.mjs"], {
		cwd: dir,
		encoding: "utf-8",
		env: { ...process.env, GITHUB_OUTPUT: outputFile },
	});
	const raw = readFileSync(outputFile, "utf-8");

	assert.equal(result.status, 0);
	assert.match(
		raw,
		/released=true/,
		"without the discriminator a regeneration is misreported as a publish",
	);
	assert.notEqual(run(dir).outputs.released, "true");
});
