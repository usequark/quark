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
 * will wait. So the signal is taken from the repository instead, and needs BOTH
 * halves: a published package's version must have advanced between HEAD~1 and
 * HEAD, *and* HEAD must be a merge of `changeset-release/main`. The first half
 * alone fires on release PR regeneration, which is not a publish.
 *
 * Writes `released=true|false` and `published=[...]` to $GITHUB_OUTPUT when
 * running in Actions.
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

// A published package's version advanced between HEAD~1 and HEAD.
const advanced = [];
const undeterminable = [];
for (const pkg of packages) {
	const previous = versionAt("HEAD~1", pkg.dir);
	if (previous === null) undeterminable.push(pkg);
	else if (previous !== pkg.version) advanced.push(pkg);
}

// Silence here is how this went wrong twice already. A shallow checkout makes
// `git show HEAD~1` fail, `advanced` comes out empty, and a genuine publish is
// reported as "nothing happened" with no error anywhere. Say so out loud.
if (undeterminable.length > 0) {
	console.warn(
		[
			"",
			`⚠️  Could not read the previous version of ${undeterminable
				.map((p) => p.name)
				.join(", ")} at HEAD~1.`,
			"",
			"   The release decision below is therefore UNRELIABLE, and a genuine",
			"   publish may be skipped. This usually means the checkout is shallow:",
			"   actions/checkout defaults to fetch-depth: 1, so the parent commit",
			"   does not exist. The Release workflow sets fetch-depth: 0 for this",
			"   reason. Do not remove it.",
			"",
		].join("\n"),
	);
}

// A version bump on its own is NOT evidence of a publish. When the release PR
// is merely *regenerated* - which happens on any ordinary commit that carries a
// changeset - changesets/action commits the bump to `changeset-release/main` and
// leaves the checkout sitting on that commit, so HEAD~1..HEAD looks exactly like
// a release. On 2026-09-29 that made this script report a release for 1.23.7 and
// publish a GitHub Release for a version npm had never received.
//
// The discriminator is the commit message. A publish only happens when the
// release PR is *merged* into main, and that merge is titled
//   Merge pull request #N from <owner>/changeset-release/main
// A regeneration leaves HEAD on a bare "chore: version packages" commit, and a
// squash-merged release is "chore: version packages (#N)" - neither matches.
const isReleaseMerge = /changeset-release\/main/i.test(headMessage);

const released = advanced.length > 0 && isReleaseMerge;
if (released) {
	console.log(
		`Release run: ${advanced.map((p) => `${p.name}@${p.version}`).join(", ")}`,
	);
} else if (advanced.length > 0) {
	console.log(
		`Version advanced to ${advanced
			.map((p) => `${p.name}@${p.version}`)
			.join(
				", ",
			)} but this is a release PR regeneration, not a publish - skipping.`,
	);
}

// A squash-merged release. A correct merge says "Merge pull request #N from
// <owner>/changeset-release/main" and never matches.
const SQUASHED_RELEASE = /^chore: version packages \(#\d+\)$/i;
if (!SQUASHED_RELEASE.test(headMessage)) {
	// Only ever publish a package list alongside released=true, so a stale list
	// can never be consumed by a caller that ignores the flag.
	reportRelease(released, released ? advanced : []);
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
