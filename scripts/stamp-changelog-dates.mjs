#!/usr/bin/env node

/**
 * stamp-changelog-dates.mjs
 *
 * Stamps an ISO date onto the CHANGELOG heading of every just-bumped package:
 * `## 1.2.3` becomes `## 1.2.3 - 2026-10-15`.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Changesets emits no dates, so no released heading has ever carried one
 * (e.g. `packages/core/CHANGELOG.md` `## 2.8.0` has no date). Undated history
 * cannot answer "when did this behaviour ship", which is the first question
 * in every upgrade decision.
 *
 * ── Why automation (a) over manual stamping (b) ─────────────────────────────
 * Manual stamping relies on a human remembering a step that fails silently
 * when skipped — the exact shape of this repo's past release incidents (a
 * squash-merged release that never published, a shallow checkout that made
 * the release guard report nothing, a missing tagger that permanently
 * disabled the `published` output). The stamp runs inside
 * `scripts/release-version.mjs`, which is the `version` step of
 * `.github/workflows/release.yml`, so the version PR already carries the
 * date and no human step exists to forget. It is idempotent and covered by
 * `stamp-changelog-dates.test.mjs`, so a future regression turns red instead
 * of silently producing another undated release.
 *
 * ── What it stamps (and what it deliberately does not) ──────────────────────
 * Only the top heading, and only when it is undated AND equals the version in
 * that package's `package.json` — i.e. the entry `changeset version` just
 * added on this run. Historical undated headings are left alone: their true
 * release dates are unknown and stamping them with today would falsify
 * history. The date is the version-PR creation date (UTC), not the merge
 * date; re-runs never rewrite an already-dated heading.
 *
 * Targets are the two published packages (mirrors the `publishedPackages()`
 * list in `scripts/check-release-published.mjs` and the `ignore` list in
 * `.changeset/config.json`).
 *
 * Date source: today in UTC, overridable with `CHANGELOG_DATE=YYYY-MM-DD`
 * for reproducibility and tests. Anything else of that shape is rejected.
 *
 * Run with: node scripts/stamp-changelog-dates.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** Directories (relative to the repo root) whose CHANGELOG gets stamped. */
export const STAMP_TARGETS = ["packages/core", "packages/cli"];

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True only for a real calendar date. The shape check alone accepts
 * `2026-02-31`, and `new Date()` silently rolls it over to March — so the
 * round-trip through UTC must reproduce the input exactly.
 */
export function isCalendarDate(value) {
	if (!DATE_RE.test(value)) return false;
	const day = new Date(`${value}T00:00:00Z`);
	return (
		!Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value
	);
}

const HEADING_RE =
	/^## (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/;

/**
 * Resolve the stamp date: `CHANGELOG_DATE` when set and well-formed,
 * otherwise today in UTC.
 */
export function resolveDate(env = process.env) {
	const override = env.CHANGELOG_DATE?.trim();
	if (override !== undefined && override !== "") {
		if (!isCalendarDate(override)) {
			throw new Error(
				`CHANGELOG_DATE must be a real calendar date (YYYY-MM-DD), got ${JSON.stringify(override)}.`,
			);
		}
		return override;
	}
	return new Date().toISOString().slice(0, 10);
}

/**
 * Stamp the top heading when it is the just-bumped, still-undated version.
 * Returns the (possibly unchanged) content and whether a stamp was applied.
 * Pure: safe to unit-test without touching the filesystem.
 */
export function stampContent(content, version, date) {
	const lines = content.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const match = HEADING_RE.exec(lines[i]);
		if (!match) continue;
		// The first version heading decides. Anything else — an already-dated
		// heading, or a heading for an older version — means there is nothing
		// this run added, so historical entries are never rewritten.
		if (match[1] !== version || match[2]) {
			return { content, stamped: false };
		}
		lines[i] = `## ${match[1]} - ${date}`;
		return { content: lines.join("\n"), stamped: true };
	}
	return { content, stamped: false };
}

/** Read a package's current version from its `package.json`, or null. */
export function packageVersion(dir, root = ROOT) {
	try {
		return JSON.parse(
			readFileSync(path.join(root, dir, "package.json"), "utf8"),
		).version;
	} catch {
		return null;
	}
}

/** Stamp one CHANGELOG file. Returns true when the file was rewritten. */
export function stampFile(changelogPath, version, date) {
	const content = readFileSync(changelogPath, "utf8");
	const { content: next, stamped } = stampContent(content, version, date);
	if (stamped) {
		writeFileSync(changelogPath, next);
	}
	return stamped;
}

const invokedDirectly =
	process.argv[1] !== undefined &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
	const date = resolveDate();
	for (const dir of STAMP_TARGETS) {
		const version = packageVersion(dir);
		if (!version) {
			console.warn(`Skipping ${dir}: could not read its package version.`);
			continue;
		}
		const changelogPath = path.join(ROOT, dir, "CHANGELOG.md");
		let stamped = false;
		try {
			stamped = stampFile(changelogPath, version, date);
		} catch (error) {
			console.warn(
				`Skipping ${changelogPath}: ${error.message ?? String(error)}`,
			);
			continue;
		}
		console.log(
			stamped
				? `Stamped ${dir} ${version} with ${date}.`
				: `No undated ${version} heading in ${dir} - nothing to stamp.`,
		);
	}
}
