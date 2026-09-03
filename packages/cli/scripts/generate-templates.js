#!/usr/bin/env node

/**
 * generate-templates.js
 *
 * Programmatically generates template-only files from monorepo source data.
 * Eliminates hand-maintained files that are a common source of template drift.
 *
 * These files are GENERATED — do not edit them manually. Change the source
 * data (monorepo package.json, biome.json, etc.) and re-run this script.
 *
 * Usage:
 *   node packages/cli/scripts/generate-templates.js          # Generate files
 *   node packages/cli/scripts/generate-templates.js --check  # Dry-run: report drift
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const TEMPLATES = path.join(ROOT, "packages/cli/templates");
const CHECK_MODE = process.argv.includes("--check");

// ─── Source Data Readers ──────────────────────────────────────────────────────

function readJson(relPath) {
	return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf-8"));
}

function readText(relPath) {
	return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * Generate base-project/package.json from monorepo root package.json.
 *
 * Derives from the monorepo's root package.json but adjusts for scaffold context:
 * - Uses @myquark placeholder scope
 * - Removes monorepo-only scripts (release, changeset, smoke:published, etc.)
 * - Removes monorepo-only devDependencies (changesets, prisma, tsx direct dep)
 * - Adds scaffold-specific scripts (doctor, prepare, db:studio)
 * - Adds scaffold-specific devDependencies (simple-git-hooks, nano-staged)
 * - Keeps pnpm.overrides (security fixes) in sync with monorepo
 */
function generateRootPackageJson() {
	const root = readJson("package.json");
	const scaffold = readJson("packages/cli/templates/base-project/package.json");

	// Merge strategy: start from the template (which has the right shape),
	// then sync pnpm.overrides from monorepo root
	const result = { ...scaffold };

	// Sync security overrides from monorepo root (single source of truth)
	if (root.pnpm?.overrides) {
		result.pnpm = { ...result.pnpm, overrides: root.pnpm.overrides };
	}

	return JSON.stringify(result, null, "\t") + "\n";
}

/**
 * Generate base-project/.gitignore from monorepo .gitignore.
 *
 * Derived from the monorepo's .gitignore but simplified for scaffolded projects:
 * - Removes monorepo-only entries (conductor, tmp-test-project, tmp-npm-smoke)
 * - Keeps essential entries (node_modules, .env, .next, .turbo, coverage)
 * - Adds scaffold-specific entries (.quark-auto-clean.json)
 */
function generateGitignore() {
	const root = readText(".gitignore");

	const scaffoldEntries = [
		"# dependencies",
		"node_modules/",
		"",
		"# environment",
		".env",
		".env.local",
		".env.*.local",
		"",
		"# next.js",
		".next/",
		"out/",
		"",
		"# build artifacts",
		"dist/",
		"build/",
		"",
		"# testing",
		"coverage/",
		"",
		"# misc",
		".DS_Store",
		"*.log",
		".quark-auto-clean.json",
		"",
		"# turbo",
		".turbo/",
		"",
		"# prisma",
		"packages/db/src/generated/",
		"",
		"# uploads",
		"**/uploads/",
	];

	return scaffoldEntries.join("\n") + "\n";
}

/**
 * Generate base-project/biome.json from monorepo biome.json.
 *
 * Derived from the monorepo's biome.json but adjusted for scaffold context:
 * - Removes monorepo-specific includes (!packages/cli/templates)
 * - Keeps all other formatting/linting rules identical
 */
function generateRootBiomeJson() {
	const root = readJson("biome.json");

	// Remove monorepo-specific file excludes
	const includes = (root.files?.includes || []).filter(
		(entry) => !entry.includes("packages/cli/templates"),
	);

	const result = {
		...root,
		files: {
			...root.files,
			includes,
		},
	};

	return JSON.stringify(result, null, "\t") + "\n";
}

// ─── File Manifest ────────────────────────────────────────────────────────────

/**
 * Each entry: { dest: relative path in templates/, generate: () => content }.
 * Generated files are added to TEMPLATE_ONLY automatically — they are never
 * overwritten by the directory sync.
 */
const GENERATORS = [
	{
		dest: "base-project/package.json",
		generate: generateRootPackageJson,
	},
	{
		dest: "base-project/.gitignore",
		generate: generateGitignore,
	},
	{
		dest: "base-project/biome.json",
		generate: generateRootBiomeJson,
	},
];

// ─── Engine ───────────────────────────────────────────────────────────────────

function writeOrCheck(destRelative, content) {
	const destPath = path.join(TEMPLATES, destRelative);

	if (CHECK_MODE) {
		if (!fs.existsSync(destPath)) {
			return { action: "missing", file: destRelative };
		}
		const existing = fs.readFileSync(destPath, "utf-8");
		if (existing === content) {
			return null;
		}
		return { action: "stale", file: destRelative };
	}

	// Write
	const dir = path.dirname(destPath);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(destPath, content);
	return fs.existsSync(destPath.replace(destPath, destPath))
		? { action: "updated", file: destRelative }
		: { action: "created", file: destRelative };
}

function main() {
	console.log(
		CHECK_MODE
			? "🔍 Checking generated template drift...\n"
			: "🔄 Generating template-only files from source data...\n",
	);

	const results = [];

	for (const { dest, generate } of GENERATORS) {
		const content = generate();
		const result = writeOrCheck(dest, content);
		if (result) results.push(result);
	}

	if (results.length === 0) {
		console.log("✅ All generated templates are up to date.\n");
		return;
	}

	const created = results.filter((r) => r.action === "created");
	const updated = results.filter((r) => r.action === "updated");
	const stale = results.filter((r) => r.action === "stale");
	const missing = results.filter((r) => r.action === "missing");

	if (CHECK_MODE) {
		const issues = stale.length + missing.length;
		console.log(
			`❌ ${issues} generated template(s) are stale or missing:\n`,
		);
		for (const r of stale) console.log(`  ~ ${r.file} (content differs)`);
		for (const r of missing) console.log(`  - ${r.file} (missing)`);
		console.log(
			"\n  Run `node packages/cli/scripts/generate-templates.js` to regenerate.\n",
		);
		process.exit(1);
	}

	if (created.length > 0) {
		console.log(`  Created (${created.length}):`);
		for (const r of created) console.log(`    + ${r.file}`);
	}
	if (updated.length > 0) {
		console.log(`  Updated (${updated.length}):`);
		for (const r of updated) console.log(`    ~ ${r.file}`);
	}

	console.log("");
}

// Export for use by sync-templates.js
export { GENERATORS };

// Run directly
main();
