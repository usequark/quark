/**
 * Audit script: check every DB-backed page has a sibling loading.js.
 *
 * Run: node scripts/check-loading.mjs
 *
 * Exit code 0 = all pages covered.
 * Exit code 1 = gaps found (prints paths).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const APP_DIR = new URL("../apps/web/src/app", import.meta.url).pathname;
const SKIP_DIRS = new Set(["node_modules", ".next", "api"]);

let failed = false;

function isDbBacked(pagePath) {
	const content = readFileSync(pagePath, "utf-8");
	return /@__QUARK_SCOPE__\/db/.test(content);
}

function visit(dir) {
	const entries = readdirSync(dir, { withFileTypes: true });
	const pagePath = join(dir, "page.js");
	if (existsSync(pagePath) && isDbBacked(pagePath)) {
		const loadingPath = join(dir, "loading.js");
		if (!existsSync(loadingPath)) {
			console.error("MISSING loading.js in", relative(APP_DIR, dir));
			failed = true;
		}
	}
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (SKIP_DIRS.has(entry.name)) continue;
		if (entry.name.startsWith("_") || entry.name.startsWith("(")) continue;
		visit(join(dir, entry.name));
	}
}

visit(APP_DIR);

if (failed) {
	console.error("\nSome DB-backed pages are missing loading.js.");
	process.exit(1);
} else {
	console.log("All DB-backed pages have a sibling loading.js.");
}
