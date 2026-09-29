#!/usr/bin/env node
/**
 * Guard against a release that bumps versions but never publishes, and tell the
 * release workflow whether this run actually published anything.
 *
 * ── Why this script exists ────────────────────────────────────────────────────
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
 * ── Why it also reports `released` ────────────────────────────────────────────
 * The "Create consolidated GitHub Release" step used to gate on
 * `steps.changesets.outputs.published`, which is a lie in this repo.
 * `changesets/action` sets that output only when it sees the literal string
 * `New tag:` in the publish output, and `changeset publish` emits it solely from
 * `tagPublish()`, which is guarded by `if (gitTag)` - the configured *tagger*.
 * `.changeset/config.json` has never had a tagger, so `New tag:` was never
 * printed, `published` was always "false", and the step was skipped on every
 * release. Four versions (1.23.3 through 1.23.6) reached npm with no tag and no
 * GitHub Release.
 *
 * npm itself is no good as the signal either: after a publish the registry took
 * this repo ~9 minutes to serve the new version, far longer than a workflow step
 * will wait. So the signal is taken from the repository instead: a release run
 * is one where a published package's version advanced between HEAD~1 and HEAD.
 * That is deterministic, needs no network, and cannot be fooled by an ordinary
 * commit that happens to land near a publish.
 *
 * Writes `released=true|false` to $GITHUB_OUTPUT when running in Actions.
 *
 * Run with: node scripts/check-release-published.mjs
 */

import { execSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
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

/** A published package's version at a given ref, or null if unreachable. */
function versionAt(ref, dir) {
	const raw = tryCapture(`git show ${ref}:${dir}/package.json`);
	if (!raw) return null;
	try {
		return JSON.parse(raw).version;
	} catch {
		return null;
	}
}

/**
 * Tell the release workflow whether this run published anything, and which
 * packages.
 *
 * Both outputs are written on every exit path, including the failure path, so
 * the step that depends on them never evaluates an empty string. `published` is
 * a single-line JSON array for the same reason.
 */
function reportRelease(released, packages) {
	if (process.env.GITHUB_OUTPUT) {
		const body = packages.map((p) => ({
			name: p.name,
			version: p.version,
		}));
		appendFileSync(
			process.env.GITHUB_OUTPUT,
			`released=${released}\npublished=${JSON.stringify(body)}\n`,
		);
	}
	return released;
}

const headMessage = tryCapture("git log -1 --format=%s");
if (!headMessage) {
	console.log("Not a git repository - skipping release check.");
	process.exit(0);
}

const packages = publishedPackages();

// A release advanced a version between HEAD~1 and HEAD. Deterministic, offline,
// and immune to the commit-message rewriting that causes the squash bug.
const advanced = packages.filter((pkg) => {
	const previous = versionAt("HEAD~1", pkg.dir);
	return previous !== null && previous !== pkg.version;
});

const released = advanced.length > 0;
if (released) {
	console.log(
		`Release run: ${advanced.map((p) => `${p.name}@${p.version}`).join(", ")}`,
	);
}

// A squash-merged release. A correct merge says "Merge pull request #N from
// <owner>/changeset-release/main" and never matches.
const SQUASHED_RELEASE = /^chore: version packages \(#\d+\)$/i;
if (!SQUASHED_RELEASE.test(headMessage)) {
	reportRelease(released, advanced);
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

// The version bump is real but it did not reach npm, so this run published
// nothing. Say so to the workflow as well as to the maintainer.
reportRelease(false, []);

process.exit(1);
