import crypto from "node:crypto";
import path from "node:path";
import { execa } from "execa";

/**
 * Shared utilities for @usequark/quark-create-app
 */

export function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find the root of the git work tree that contains `dir`, if any.
 *
 * Used to avoid scaffolding a project into a nested git repository: running
 * `git init` inside an existing work tree creates a second, independent
 * repository that shadows the outer one and breaks commits at the repo root.
 *
 * @param {string} dir - Directory to inspect (must already exist)
 * @returns {Promise<string|null>} Absolute path to the enclosing repository
 *   root, or null when `dir` is not inside a git work tree (or git is not
 *   available)
 */
export async function findEnclosingGitRepo(dir) {
	try {
		const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"], {
			cwd: dir,
		});
		const topLevel = stdout.trim();
		return topLevel ? path.resolve(topLevel) : null;
	} catch {
		// Not inside a work tree, or git is not installed
		return null;
	}
}

export function generateSecret(length = 32) {
	return crypto
		.randomBytes(length)
		.toString("base64")
		.replace(/[/+=]/g, "")
		.substring(0, length);
}

/**
 * Format a project slug into a human-friendly application name.
 *
 * - Hyphens, underscores, and dots are treated as word separators
 * - Each word is title-cased
 * - Degenerate inputs (all separators) fall back to "Quark App"
 *
 * @param {string} projectName - Raw project slug (e.g. "my-cool-app")
 * @returns {string} Title-cased display name (e.g. "My Cool App")
 *
 * @example
 * formatProjectDisplayName("my-cool-app")   // "My Cool App"
 * formatProjectDisplayName("my.app")         // "My App"
 * formatProjectDisplayName("my_app_v2")      // "My App V2"
 * formatProjectDisplayName("myapp")          // "Myapp"
 * formatProjectDisplayName("---")            // "Quark App"
 */
export function formatProjectDisplayName(projectName) {
	const normalized = projectName
		.replace(/[-_.]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	if (!normalized) {
		return "Quark App";
	}

	return normalized
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}
