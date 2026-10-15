/**
 * Regenerate the handler-table block in README.md from JOB_NAMES.
 *
 * Usage (from apps/worker): pnpm sync-readme
 *
 * `src/readme-consistency.test.js` fails on drift between the job definitions,
 * the registry, and the table; this command writes the fix instead of leaving
 * the maintainer to retype it by hand.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { jobHandlers } from "../src/handlers/index.js";
import {
	replaceHandlerTable,
	TABLE_END,
	TABLE_START,
} from "../src/readme-table.js";

const readmePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"README.md",
);
const current = readFileSync(readmePath, "utf-8");

// The scaffolded worker README is a hand-authored quickstart with no table.
if (!current.includes(TABLE_START) || !current.includes(TABLE_END)) {
	console.log("README has no handler-table markers; nothing to regenerate.");
	process.exit(0);
}

const next = replaceHandlerTable(current, jobHandlers);

if (next === current) {
	console.log("README handler table is already up to date.");
} else {
	writeFileSync(readmePath, next);
	console.log("Regenerated the README handler table.");
}
