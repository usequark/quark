#!/usr/bin/env node
/**
 * Guard against a release that bumps versions but never publishes.
 *
 * Changesets decides whether to publish by checking whether the current commit
 * came from the `changeset-release/main` branch. A **squash** merge rewrites the
 * commit message to `chore: version packages (#123)`, which drops the branch
 * name, so the action concludes no release was merged and merely regenerates the
 * release PR.
 *
 * The failure is silent and nasty: versions are bumped in package.json and
 * CHANGELOG, CI is green, and npm keeps serving the previous version. Several
 * releases shipped that way before anyone noticed.
 *
 * A correctly merged release produces a commit message like:
 *   Merge pull request #152 from Bobnoddle/changeset-release/main
 *
 * So: if HEAD is a squash-merged release commit, warn loudly.
 *
 * Run with: node scripts/check-release-published.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function tryCapture(cmd) {
	try {
		return execSync(cmd, { encoding: "utf8" }).toString().trim();
	} catch {
		return null;
	}
}

/** Package names changesets publishes (everything not in config.json `ignore`). */
function publishedPackages() {
	const config = JSON.parse(
		readFileSync(path.join(ROOT, ".changeset/config.json"), "utf8"),
	);
	const ignored = new Set(config.ignore ?? []);
	return ["packages/core", "packages/cli"]
		.map((dir) => {
			try {
				const pkg = JSON.parse(
					readFileSync(path.join(ROOT, dir, "package.json"), "utf8"),
				);
				return { dir, name: pkg.name, version: pkg.version };
			} catch {
				return null;
			}
		})
		.filter((pkg) => pkg && !ignored.has(pkg.name));
}

function compareVersions(a, b) {
	const pa = a.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
	const pb = b.split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

const headMessage = tryCapture("git log -1 --format=%s");
if (!headMessage) {
	console.log("Not a git repository - skipping release check.");
	process.exit(0);
}

// A squash-merged release. A correct merge says "Merge pull request #N from
// <owner>/changeset-release/main" and never matches.
const SQUASHED_RELEASE = /^chore: version packages \(#\d+\)$/i;
if (!SQUASHED_RELEASE.test(headMessage)) {
	process.exit(0);
}

console.error(
	[
		"",
		"❌ A release commit reached main via squash merge, so it did not publish.",
		"",
		`   Commit: ${headMessage}`,
		"",
		"   Changesets identifies a release by the `changeset-release/main` branch",
		"   name in the commit message. A squash merge rewrites it, so the release",
		"   action skipped publishing and only regenerated the release PR.",
		"",
		"   Fix:",
		"     1. Revert this commit, or bump the versions back by hand.",
		"     2. Re-merge the release PR with a MERGE COMMIT, not squash:",
		"          gh pr merge <number> --merge",
		"",
	].join("\n"),
);

// Surface the drift so the maintainer can see the size of the gap.
const packages = publishedPackages();
for (const pkg of packages) {
	const published = tryCapture(
		`npm view ${pkg.name} version 2>/dev/null || true`,
	);
	if (!published) continue;
	if (compareVersions(pkg.version, published) > 0) {
		console.error(
			`   ${pkg.name}: main is ${pkg.version}, npm has ${published} — not published.`,
		);
	}
}
console.error("");

process.exit(1);
