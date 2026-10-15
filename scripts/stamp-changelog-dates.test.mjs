/**
 * Tests for scripts/stamp-changelog-dates.mjs.
 *
 * The stamp is the only thing standing between "releases carry dates" and a
 * return to undated history, so each of its decisions is asserted here: it
 * stamps the just-bumped undated heading, never rewrites an already-dated
 * one, and never backfills historical undated headings with today (their
 * true release dates are unknown and inventing them would falsify history).
 * The date override exists for reproducibility and is validated for the same
 * reason — a malformed CHANGELOG_DATE must fail loudly, not stamp garbage.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
	packageVersion,
	resolveDate,
	stampContent,
	stampFile,
} from "./stamp-changelog-dates.mjs";

test("stamps the undated top heading matching the bumped version", () => {
	const { content, stamped } = stampContent(
		"# @usequark/quark-core\n\n## 2.9.0\n\n### Minor Changes\n",
		"2.9.0",
		"2026-10-15",
	);
	assert.equal(stamped, true);
	assert.ok(content.includes("## 2.9.0 - 2026-10-15"));
});

test("leaves an already-dated heading untouched", () => {
	const input =
		"# @usequark/quark-core\n\n## 2.9.0 - 2026-10-14\n\n### Minor Changes\n";
	const { content, stamped } = stampContent(input, "2.9.0", "2026-10-15");
	assert.equal(stamped, false);
	assert.equal(content, input);
});

test("does not backfill historical undated headings", () => {
	// The top heading is an older release (the bump landed elsewhere or not
	// at all): stamping it with today would attribute the wrong date.
	const input = "# @usequark/quark-core\n\n## 2.8.0\n\n### Minor Changes\n";
	const { content, stamped } = stampContent(input, "2.9.0", "2026-10-15");
	assert.equal(stamped, false);
	assert.equal(content, input);
});

test("ignores a file with no version heading", () => {
	const input = "# @usequark/quark-core\n\nNo releases yet.\n";
	const { content, stamped } = stampContent(input, "2.9.0", "2026-10-15");
	assert.equal(stamped, false);
	assert.equal(content, input);
});

test("stamps a prerelease heading", () => {
	const { content, stamped } = stampContent(
		"## 2.9.0-next.0\n",
		"2.9.0-next.0",
		"2026-10-15",
	);
	assert.equal(stamped, true);
	assert.ok(content.includes("## 2.9.0-next.0 - 2026-10-15"));
});

test("resolveDate honours a well-formed CHANGELOG_DATE", () => {
	assert.equal(resolveDate({ CHANGELOG_DATE: "2026-01-02" }), "2026-01-02");
});

test("resolveDate rejects a malformed CHANGELOG_DATE", () => {
	assert.throws(
		() => resolveDate({ CHANGELOG_DATE: "15/10/2026" }),
		/CHANGELOG_DATE must be YYYY-MM-DD/,
	);
});

test("resolveDate defaults to today in UTC", () => {
	assert.equal(resolveDate({}), new Date().toISOString().slice(0, 10));
});

test("stampFile rewrites the file only when stamping", () => {
	const dir = mkdtempSync(path.join(tmpdir(), "stamp-test-"));
	const changelogPath = path.join(dir, "CHANGELOG.md");
	writeFileSync(changelogPath, "# pkg\n\n## 1.0.1\n");
	assert.equal(stampFile(changelogPath, "1.0.1", "2026-10-15"), true);
	assert.ok(
		readFileSync(changelogPath, "utf8").includes("## 1.0.1 - 2026-10-15"),
	);
	assert.equal(stampFile(changelogPath, "1.0.1", "2026-10-15"), false);
});

test("packageVersion reads the version and returns null when absent", () => {
	const dir = mkdtempSync(path.join(tmpdir(), "stamp-pkg-"));
	mkdirSync(path.join(dir, "packages", "core"), { recursive: true });
	writeFileSync(
		path.join(dir, "packages", "core", "package.json"),
		JSON.stringify({ name: "core", version: "9.9.9" }),
	);
	assert.equal(packageVersion("packages/core", dir), "9.9.9");
	assert.equal(packageVersion("packages/missing", dir), null);
});
