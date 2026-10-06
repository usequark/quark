/**
 * Tests for scripts/run-tests.mjs.
 *
 * This runner is the `test` script for `apps/web` and `apps/worker` in every
 * scaffolded project, and it is what decides whether a freshly scaffolded
 * repository can be pushed at all.
 *
 * It used to exit 1 when it collected zero `*.test.js` files. A new scaffold
 * ships no test files, so `pnpm test` failed, which failed the `pre-push` hook
 * that `scripts/prepare.mjs` installs, which made the very first `git push`
 * impossible without `--no-verify`. The four library packages were unaffected
 * because they use stock `node --test` with a glob, which already exits 0 when
 * it matches nothing - the inconsistency was the bug.
 *
 * Both halves of that decision are asserted here: an empty suite exits 0, and a
 * suite with a real failure still exits non-zero. Asserting only the first half
 * would pass just as happily against a runner that swallowed every failure.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const SCRIPT = path.join(REPO_ROOT, "scripts", "run-tests.mjs");

/**
 * A throwaway directory tree. Keys are relative paths, values are contents.
 */
function makeFixture(files = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), "run-tests-fixture-"));
	for (const [relative, contents] of Object.entries(files)) {
		const target = path.join(dir, relative);
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, contents);
	}
	return dir;
}

/**
 * Run the runner.
 *
 * `cwd` defaults to the repository root so the `--import tsx/esm` the runner
 * passes to `node --test` resolves against the real `node_modules`. Fixture
 * roots are always passed as absolute paths so they cannot be confused with the
 * repository's own `src`.
 *
 * `NODE_TEST_CONTEXT` is stripped. This suite runs under `node --test`, which
 * exports `NODE_TEST_CONTEXT=child-v8` and git inherits it; the runner's own
 * `node --test` grandchild then sees it, refuses to run ("node:test run() is
 * being called recursively within a test file. skipping running files") and
 * exits 0. That would make the non-empty cases below assert nothing at all -
 * the marker would never be written and the failing suite would look green.
 * Removing the variable puts the grandchild back in the situation it actually
 * runs in: `pnpm test` from a shell.
 */
function run(args = [], { cwd = REPO_ROOT, script = SCRIPT } = {}) {
	const env = { ...process.env };
	delete env.NODE_TEST_CONTEXT;
	delete env.NODE_TEST_WORKER_ID;

	const result = spawnSync(process.execPath, [script, ...args], {
		cwd,
		encoding: "utf-8",
		env,
	});

	return {
		code: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

/**
 * A test file that records the fact it ran.
 *
 * Asserting on the runner's own reporter output would couple these tests to
 * `node --test`'s TAP formatting, which is not the thing under test. A sentinel
 * file proves the child process really executed, independent of output format.
 */
function sentinelTest(marker) {
	return [
		'import { writeFileSync } from "node:fs";',
		'import test from "node:test";',
		"",
		`test("writes its marker", () => {`,
		`\twriteFileSync(${JSON.stringify(marker)}, "ran");`,
		"});",
		"",
	].join("\n");
}

test("an empty directory is not a failure", () => {
	// The regression this file exists for. Exits 1 before the fix.
	const dir = makeFixture();
	const result = run([dir]);

	assert.equal(result.code, 0, "an empty suite must exit 0");
	assert.match(result.stdout, /No test files found/);
	assert.match(result.stdout, /nothing to run/);
});

test("a directory of non-test files is not a failure", () => {
	// Same condition, but reached the way a real scaffold reaches it: `src`
	// full of application code and not one test file.
	const dir = makeFixture({
		"src/index.js": "export const a = 1;\n",
		"src/lib/util.js": "export const b = 2;\n",
		"src/README.md": "# not a test\n",
	});
	const result = run([dir]);

	assert.equal(result.code, 0);
	assert.match(result.stdout, /nothing to run/);
});

test("excluding every test file is not a failure", () => {
	// apps/web passes `--exclude=integration.test.js`. A project that has only
	// integration tests ends up with an empty selection after filtering, which
	// is the same empty-suite condition by a different route.
	const dir = makeFixture({
		"src/integration.test.js":
			'import test from "node:test";\ntest("x", () => {});\n',
	});
	const result = run([dir, "--exclude=integration.test.js"]);

	assert.equal(result.code, 0);
	assert.match(result.stdout, /nothing to run/);
});

test("defaults to src when no root is given", () => {
	// The scaffolded apps invoke `run-tests.mjs src`, but the runner defaults
	// to `src` when invoked bare. That default must agree with the empty-suite
	// rule rather than throw on a missing directory.
	const dir = makeFixture({ "src/app/page.js": "export const x = 1;\n" });
	const result = run([], { cwd: dir });

	assert.equal(result.code, 0);
	assert.match(result.stdout, /No test files found in: src/);
});

test("a suite with a passing test runs it and exits 0", () => {
	const marker = path.join(
		mkdtempSync(path.join(tmpdir(), "run-tests-marker-")),
		"ran",
	);
	const dir = makeFixture({ "src/index.test.js": sentinelTest(marker) });
	const result = run([dir]);

	assert.ok(
		existsSync(marker),
		"the test file must actually have been executed",
	);
	assert.equal(result.code, 0);
});

test("a suite with a failing test exits non-zero", () => {
	// Without this, "always exit 0" would satisfy every test above while
	// silently passing broken projects.
	const dir = makeFixture({
		"src/index.test.js": [
			'import test from "node:test";',
			'test("deliberately fails", () => {',
			'\tthrow new Error("boom");',
			"});",
			"",
		].join("\n"),
	});
	const result = run([dir]);

	assert.notEqual(result.code, 0, "a real failure must still fail the run");
});

test("collects test files from nested directories", () => {
	const root = mkdtempSync(path.join(tmpdir(), "run-tests-marker-"));
	const marker = path.join(root, "ran");
	const dir = makeFixture({
		"src/lib/deep/nested/thing.test.js": sentinelTest(marker),
	});

	// The whole point of collectTests is recursion; if it regressed to a
	// single level, the empty-suite path would start firing on real projects.
	assert.equal(run([dir]).code, 0);
	assert.ok(existsSync(marker), "nested test files must be collected");
});

test("collects test files from a Next.js [id] directory", () => {
	// `node --test` matches its file arguments as globs. A dynamic route segment
	// like `[id]` is a character class matching a single `i` or `d`, so the
	// unescaped path matched nothing - and the failure was silent, reporting
	// zero tests and exiting 0. Every test co-located in a dynamic segment was
	// therefore never collected: `api/files/[id]/route.test.js` in the scaffold,
	// plus `users/[id]` and `[...nextauth]`, which have no tests for the same
	// reason.
	const marker = path.join(
		mkdtempSync(path.join(tmpdir(), "run-tests-marker-")),
		"ran",
	);
	const dir = makeFixture({
		"src/app/api/files/[id]/route.test.js": sentinelTest(marker),
	});

	const result = run([dir]);

	assert.ok(
		existsSync(marker),
		"a test file in a [id] directory must be collected and executed",
	);
	assert.equal(result.code, 0);
});

test("collects test files from a [...slug] catch-all directory", () => {
	const marker = path.join(
		mkdtempSync(path.join(tmpdir(), "run-tests-marker-")),
		"ran",
	);
	const dir = makeFixture({
		"src/app/api/files/[...slug]/route.test.js": sentinelTest(marker),
	});

	run([dir]);

	assert.ok(
		existsSync(marker),
		"a test file in a [...slug] directory must be collected and executed",
	);
});

test("collects bracketed and unbracketed test files in the same run", () => {
	// Escaping must not disturb the paths around it. A blanket escape that broke
	// ordinary filenames would still pass the two tests above.
	const bracketMarker = path.join(
		mkdtempSync(path.join(tmpdir(), "run-tests-marker-")),
		"ran",
	);
	const plainMarker = path.join(
		mkdtempSync(path.join(tmpdir(), "run-tests-marker-")),
		"ran",
	);
	const dir = makeFixture({
		"src/app/api/files/[id]/route.test.js": sentinelTest(bracketMarker),
		"src/app/api/files/route.test.js": sentinelTest(plainMarker),
		"src/lib/thing.test.js": sentinelTest(plainMarker),
	});

	run([dir]);

	assert.ok(existsSync(bracketMarker), "bracketed test must run");
	assert.ok(existsSync(plainMarker), "unbracketed tests must still run");
});

test("the glob-escaping rule is load-bearing, not incidental", () => {
	// The same reasoning as the mutation test below: prove that dropping the
	// escape regresses a real collection rather than trusting that it does.
	const original = readFileSync(SCRIPT, "utf-8");
	const mutatedSource = original.replace(
		"...files.map(escapeGlobChars),",
		"...files,",
	);
	assert.notEqual(
		mutatedSource,
		original,
		"mutation applied - the escape call is no longer where this test expects it",
	);

	const dir = makeFixture({
		"src/app/api/files/[id]/route.test.js":
			'import test from "node:test";\ntest("x", () => {});\n',
	});
	const mutated = path.join(dir, "run-tests-mutated.mjs");
	writeFileSync(mutated, mutatedSource);

	const result = run([dir], { script: mutated });

	// `collectTests` walks the filesystem with readdirSync, so it does find the
	// file and `files.length` is 1 - the empty-suite message is never printed.
	// The drop happens one step later, at `node --test`, which reports zero
	// tests. That is what makes the bug silent: the suite looks like it ran.
	assert.match(
		result.stdout,
		/^ℹ tests 0$/m,
		"without the escape, node --test reports zero tests for the bracketed path",
	);
	assert.equal(
		result.code,
		0,
		"and it exits 0 all the same, which is why nothing flagged the drop",
	);
});

test("the empty-suite rule is what makes the runner exit 0, not the absence of tests", () => {
	// Guards against the guard. Restoring the old `process.exit(1)` looks like
	// a harmless one-character revert and reintroduces the unpushable scaffold
	// exactly, so assert the mutated runner really does regress.
	const mutatedSource = readFileSync(SCRIPT, "utf-8").replace(
		"nothing to run.`);\n\tprocess.exit(0);",
		"nothing to run.`);\n\tprocess.exit(1);",
	);
	assert.notEqual(
		mutatedSource,
		readFileSync(SCRIPT, "utf-8"),
		"mutation applied - the empty-suite exit code is no longer where this test expects it",
	);

	const dir = makeFixture();
	const mutated = path.join(dir, "run-tests-mutated.mjs");
	writeFileSync(mutated, mutatedSource);

	const result = run([dir], { script: mutated });
	assert.equal(
		result.code,
		1,
		"with process.exit(1) restored, an empty suite fails again - the fix is load-bearing",
	);
});
