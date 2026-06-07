import crypto from "node:crypto";

/**
 * Shared utilities for @techstream/quark-create-app
 */

export function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
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
