#!/usr/bin/env node
/**
 * Cross-platform git hooks setup script.
 * Runs simple-git-hooks only when inside a git repository.
 * Replaces the bash-only `prepare` one-liner to support Windows.
 */
import { execSync } from "node:child_process";

try {
	execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
} catch {
	// Not inside a git repo (e.g. npx install, CI without checkout) — skip hooks setup.
	process.exit(0);
}

try {
	execSync("npx simple-git-hooks", { stdio: "inherit" });
} catch {
	// Hooks setup failed — non-fatal, do not block installs.
}
