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

import { SCAFFOLD_GITIGNORE } from "../src/scaffold-gitignore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const TEMPLATES = path.join(ROOT, "packages/cli/templates");
const CHECK_MODE = process.argv.includes("--check");

// ─── Source Data Readers ──────────────────────────────────────────────────────

function readJson(relPath) {
	return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf-8"));
}

function _readText(relPath) {
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

	return `${JSON.stringify(result, null, "\t")}\n`;
}

/**
 * Generate base-project/.gitignore.
 *
 * The content lives in src/scaffold-gitignore.js, not here. npm strips every
 * .gitignore from published tarballs, so the CLI cannot read this file when
 * installed from npm and has to carry the content itself. Writing this copy from
 * the same export keeps the two identical.
 */
function generateGitignore() {
	return SCAFFOLD_GITIGNORE;
}

/**
 * Generate base-project/biome.json from monorepo biome.json.
 *
 * Derived from the monorepo's biome.json but adjusted for scaffold context:
 * - Removes monorepo-specific includes (!packages/cli/templates)
 * - Keeps all other formatting/linting rules identical
 *
 * The config must NOT set `root: false`. With `root: false` Biome looks for a
 * root configuration in ancestor directories; when the scaffold is standalone
 * there is none, so Biome falls back to its built-in defaults and applies none
 * of this file. Observed consequences in a scaffold: `files.includes` negations
 * stop excluding anything (so `packages/db/src/generated` gets linted),
 * `.gitignore` is not consulted, and `css.parser.tailwindDirectives` is unset so
 * every Tailwind at-rule in globals.css reports a parse error. `pnpm lint` fails
 * on a freshly scaffolded project.
 *
 * Biome resolves the nearest configuration when the key is absent, so nesting a
 * project inside a larger repository works without it — verified against Biome
 * 2.5.14, which does not reject a nested root configuration.
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

	// Drop the key entirely rather than setting it to true, so the template
	// cannot drift back to root: false.
	if ("root" in result) delete result.root;

	return `${JSON.stringify(result, null, "\t")}\n`;
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
		console.log(`❌ ${issues} generated template(s) are stale or missing:\n`);
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
