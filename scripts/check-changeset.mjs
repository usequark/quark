#!/usr/bin/env node
/**
 * Pre-push changeset check.
 *
 * Fails the push if a published package changed without a changeset, so the
 * developer is notified before CI's "Changeset Status" check runs.
 *
 * Skips the changesets release branch (it has consumed its changesets by design).
 *
 * CI's changeset-check is the real gate; this is an early, local convenience.
 * So when the check cannot reach a verdict it warns and lets the push through
 * rather than blocking with a misleading message.
 */
import { execSync } from "node:child_process";

/** Run a command, returning trimmed stdout, or null if it failed. */
function tryCapture(cmd, opts = {}) {
	try {
		return execSync(cmd, { encoding: "utf8", ...opts }).toString().trim();
	} catch {
		return null;
	}
}

// Git sets GIT_DIR to the worktree gitdir when running hooks, which breaks
// changeset's git-based changed-package detection. Unset it so git resolves
// refs against the normal repository context.
const env = { ...process.env };
delete env.GIT_DIR;
delete env.GIT_WORK_TREE;
delete env.GIT_PREFIX;

// Skip on the changesets release branch (no changesets by design).
const branch = tryCapture("git rev-parse --abbrev-ref HEAD", { env });
if (!branch || branch === "changeset-release/main") {
	process.exit(0);
}

const isShallow = () =>
	tryCapture("git rev-parse --is-shallow-repository", { env }) === "true";

/** `git merge-base` exits non-zero when the refs share no common ancestor. */
const hasMergeBase = () =>
	tryCapture("git merge-base HEAD origin/main", { env }) !== null;

// Ensure origin/main is present, then deepen a bounded number of times if a
// shallow clone still cannot compare it.
//
// This deliberately avoids `git fetch --depth=1`, which on a shallow clone
// re-shrinks the shallow boundary and discards the history needed to find a
// merge-base - the reason this script used to report a bogus failure.
try {
	execSync("git fetch origin main", {
		stdio: "ignore",
		env: { ...env, GIT_TERMINAL_PROMPT: "0" },
	});
} catch {
	// Reported below with a clear message if it matters.
}

if (isShallow() && !hasMergeBase()) {
	for (let attempt = 0; attempt < 3 && !hasMergeBase(); attempt++) {
		try {
			execSync(`git fetch --deepen=${300 * (attempt + 1)} origin main`, {
				stdio: "ignore",
				env,
			});
		} catch {
			break;
		}
	}
}

const skipUndecidable = (reason) => {
	console.warn(
		[
			"",
			"⚠️  Skipping the changeset check: this branch cannot be compared to",
			"   origin/main, so the result would be unreliable.",
			"",
			`   ${reason}`,
			"",
			"   To fix: git fetch --unshallow origin",
			"",
			'   CI\'s "Changeset Status" check will still enforce this on the PR.',
			"",
		].join("\n"),
	);
	process.exit(0);
};

if (!hasMergeBase()) {
	skipUndecidable("the clone is missing history for a merge-base.");
}

let output = "";
let failed = false;
try {
	output = execSync("pnpm changeset status --since=origin/main", {
		encoding: "utf8",
		env,
	}).toString().trim();
} catch (error) {
	failed = true;
	output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
}

if (!failed) {
	if (output) console.log(output);
	process.exit(0);
}

// A history problem is not a missing changeset. The old version reported every
// failure as "Changeset required", so a broken clone was blamed on the
// developer for forgetting a changeset.
if (/Failed to find where|diverge|not a git repository|bad revision|unknown revision/i.test(output)) {
	skipUndecidable(output.split("\n").find((line) => line.trim()) ?? "");
}

console.error(output);
console.error(
	"\n❌ Changeset required: a published package changed but no changeset was found.",
);
console.error(
	"   Run `pnpm changeset` to add one, or `pnpm changeset add --empty` if no release is needed.\n",
);
process.exit(1);
