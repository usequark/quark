#!/usr/bin/env node
/**
 * Pre-push changeset check.
 *
 * Fails the push if a published package changed without a changeset, so the
 * developer is notified before CI's "Changeset Status" check runs.
 *
 * Skips the changesets release branch (it has consumed its changesets by design).
 */
import { execSync } from "node:child_process";

function run(cmd, opts = {}) {
	return execSync(cmd, { stdio: "inherit", ...opts });
}

function runCapture(cmd) {
	return execSync(cmd, { encoding: "utf8" }).toString().trim();
}

// Skip on the changesets release branch (no changesets by design).
let branch = "";
try {
	branch = runCapture("git rev-parse --abbrev-ref HEAD");
} catch {
	process.exit(0);
}
if (branch === "changeset-release/main") {
	process.exit(0);
}

// Ensure origin/main is available for the --since comparison.
try {
	run("git fetch origin main --depth=1", { stdio: "ignore" });
} catch {
	// Best-effort; changeset status will surface any problem.
}

try {
	run("pnpm changeset status --since=origin/main");
} catch {
	console.error(
		"\n❌ Changeset required: a published package changed but no changeset was found.",
	);
	console.error(
		"   Run `pnpm changeset` to add one, or `pnpm changeset add --empty` if no release is needed.\n",
	);
	process.exit(1);
}
