#!/usr/bin/env node

/**
 * sync-templates.js
 *
 * Generates CLI scaffold templates from monorepo source files.
 * Ensures templates stay in sync with the canonical monorepo implementation,
 * eliminating manual mirroring and preventing drift.
 *
 * Usage:
 *   node packages/cli/scripts/sync-templates.js               # Sync templates
 *   node packages/cli/scripts/sync-templates.js --check        # Dry-run: report drift without modifying files
 *   node packages/cli/scripts/sync-templates.js --pre-commit   # Sync only if staged files affect source dirs, then git-add
 *
 * How it works:
 *   1. Copies source files from monorepo packages → template directories
 *   2. Applies exclusions (monorepo-only files, generated code, coverage)
 *   3. Applies transforms (package.json naming, dependency adjustments)
 *   4. Preserves template-only files (generation templates, scaffolding configs)
 *   5. Cleans stale files from template that no longer exist in source
 *
 * In CI, run with --check after the sync step to catch uncommitted drift.
 */

import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const TEMPLATES = path.join(ROOT, "packages/cli/templates");
const CHECK_MODE = process.argv.includes("--check");
const PRE_COMMIT_MODE = process.argv.includes("--pre-commit");

function validateTemplateMigration() {
	execSync("node packages/cli/scripts/validate-template-migration.js", {
		cwd: ROOT,
		stdio: "inherit",
	});
}

// Derive quark-core version pin from the actual package (e.g. "2.3.0" → "^2.0.0")
const coreVersion = JSON.parse(
	fs.readFileSync(path.join(ROOT, "packages/core/package.json"), "utf8"),
).version;
const CORE_VERSION_PIN = `^${coreVersion.split(".")[0]}.0.0`;

// ─── Sync Configuration ───────────────────────────────────────────────────────

/**
 * Directory mappings: monorepo source → template destination.
 * Source paths are relative to repo root; dest paths relative to templates/.
 * Within each mapping, ALL files are synced unless excluded.
 */
const SYNC_DIRS = [
	// localExcludes are checked in addition to global EXCLUDE_PATTERNS, but only for this mapping.
	{
		src: "apps/web",
		dest: "base-project/apps/web",
		// Admin routes are scaffolded conditionally via admin-routes template - exclude from base project
		// CMS public files are scaffolded conditionally via cms-public template
		localExcludes: [
			/^apps\/web\/src\/app\/admin\//,
			/^apps\/web\/src\/lib\/content\//,
			/^apps\/web\/src\/lib\/load-cms-config\.js$/,
			/^apps\/web\/src\/lib\/public-content-routes\.js$/,
			/^apps\/web\/src\/lib\/public-content\.js$/,
			/^apps\/web\/src\/lib\/public-content-cache\.js$/,
			/^apps\/web\/src\/lib\/public-content-revalidation\.js$/,
			/^apps\/web\/src\/lib\/public-content\.test\.js$/,
			/^apps\/web\/src\/lib\/public-content-routes\.test\.js$/,
			/^apps\/web\/src\/lib\/load-cms-config\.test\.js$/,
			/^apps\/web\/src\/adminIntrospect\.test\.js$/,
			/^apps\/web\/src\/app\/_components\/PageContentRenderer\.js$/,
			/^apps\/web\/src\/app\/\[slug\]\//,
			/^apps\/web\/src\/app\/api\/cms\//,
		],
	},
	{ src: "apps/worker", dest: "worker" },
	{ src: "packages/db", dest: "base-project/packages/db" },
	{ src: "packages/config", dest: "config" },
	{ src: "packages/ui", dest: "ui" },
	{ src: "packages/jobs", dest: "jobs" },
	{ src: "packages/admin", dest: "admin" },
	// Admin routes live inside apps/web but are scaffolded separately (conditionally)
	{
		src: "apps/web/src/app/admin",
		dest: "admin-routes",
		// CMS/CRM/AI routes are scaffolded separately via their own templates
		localExcludes: [
			/^apps\/web\/src\/app\/admin\/cms\//,
			/^apps\/web\/src\/app\/admin\/crm\//,
			/^apps\/web\/src\/app\/admin\/ai\//,
		],
	},
	// CMS package (content models, slug helpers, status lifecycle)
	{ src: "packages/cms", dest: "cms" },
	// CMS admin routes - scaffolded conditionally alongside the CMS package
	{
		src: "apps/web/src/app/admin/cms",
		dest: "cms-routes",
	},
	// CRM package (contacts, companies, pipeline)
	{ src: "packages/crm", dest: "crm" },
	// CRM admin routes - scaffolded conditionally alongside the CRM package
	{
		src: "apps/web/src/app/admin/crm",
		dest: "crm-routes",
	},
	// AI package (permissions, audit, workflow engine)
	{ src: "packages/ai", dest: "ai" },
	// AI chat admin routes - scaffolded conditionally alongside the ai feature
	{
		src: "apps/web/src/app/admin/ai",
		dest: "ai-routes",
	},
];

/**
 * Individual file mappings: monorepo source → template destination.
 */
const SYNC_FILES = [
	{ src: ".dockerignore", dest: "base-project/.dockerignore" },
	{
		src: "scripts/dev-preflight.mjs",
		dest: "base-project/scripts/dev-preflight.mjs",
	},
	{
		src: "scripts/clean-workspace.mjs",
		dest: "base-project/scripts/clean-workspace.mjs",
	},
	{ src: "turbo.json", dest: "base-project/turbo.json" },
	{ src: "docker-compose.yml", dest: "base-project/docker-compose.yml" },
	{
		src: "docker-compose.override.yml",
		dest: "base-project/docker-compose.override.yml",
	},
	{
		src: "pnpm-workspace.yaml",
		dest: "base-project/pnpm-workspace.yaml",
	},
	// CMS public files - scaffolded conditionally alongside CMS package,
	// synced individually since they're interleaved with non-CMS files
	{ src: "apps/web/src/app/sitemap.js", dest: "cms-public/app/sitemap.js" },
	{
		src: "apps/web/src/app/[slug]/page.js",
		dest: "cms-public/app/[slug]/page.js",
	},
	{
		src: "apps/web/src/app/_components/PageContentRenderer.js",
		dest: "cms-public/app/_components/PageContentRenderer.js",
	},
	{
		src: "apps/web/src/app/api/cms/media/route.js",
		dest: "cms-public/app/api/cms/media/route.js",
	},
	{
		src: "apps/web/src/lib/content/page-content.js",
		dest: "cms-public/lib/content/page-content.js",
	},
	{
		src: "apps/web/src/lib/content/page-content.test.js",
		dest: "cms-public/lib/content/page-content.test.js",
	},
	{
		src: "apps/web/src/lib/load-cms-config.js",
		dest: "cms-public/lib/load-cms-config.js",
	},
	{
		src: "apps/web/src/lib/load-cms-config.test.js",
		dest: "cms-public/lib/load-cms-config.test.js",
	},
	{
		src: "apps/web/src/lib/public-content-routes.js",
		dest: "cms-public/lib/public-content-routes.js",
	},
	{
		src: "apps/web/src/lib/public-content-routes.test.js",
		dest: "cms-public/lib/public-content-routes.test.js",
	},
	{
		src: "apps/web/src/lib/public-content.js",
		dest: "cms-public/lib/public-content.js",
	},
	{
		src: "apps/web/src/lib/public-content.test.js",
		dest: "cms-public/lib/public-content.test.js",
	},
	{
		src: "apps/web/src/lib/public-content-cache.js",
		dest: "cms-public/lib/public-content-cache.js",
	},
	{
		src: "apps/web/src/lib/public-content-revalidation.js",
		dest: "cms-public/lib/public-content-revalidation.js",
	},
	{
		src: "apps/web/src/adminIntrospect.test.js",
		dest: "cms-public/adminIntrospect.test.js",
	},
];

/**
 * Patterns to EXCLUDE from sync (matched against source paths relative to repo root).
 * These are monorepo-only files that should not appear in scaffold templates.
 */
const EXCLUDE_PATTERNS = [
	// Build artifacts / tooling
	/node_modules\//,
	/\.turbo\//,
	/coverage\//,
	/\.next\//,
	/\.env$/,
	/^apps\/web\/uploads\//,

	// Prisma generated code - users run `prisma generate` post-scaffold
	/\/src\/generated\//,

	// Release artifacts - CHANGELOGs are generated by the release workflow and
	// are not meant to be scaffolded into new projects
	/CHANGELOG\.md$/,

	// Monorepo-only web files (advanced features not in starter template)
	/^apps\/web\/src\/proxy\.redis\.js$/,
	/^apps\/web\/src\/app\/api\/metrics\//,
	/^apps\/web\/src\/app\/api\/integration\.test\.js$/,
	/^apps\/web\/src\/app\/manifest\.js$/,
	/^apps\/web\/src\/app\/manifest\.test\.js$/,
	/^apps\/web\/src\/app\/seo-routes\.test\.js$/,
	/^apps\/web\/src\/lib\/seo\//,
	/^apps\/web\/README\.md$/,

	// DB: migrations are template-managed (single squashed initial migration)
	/^packages\/db\/prisma\/migrations\//,

	// Config: test files and coverage (config tests are monorepo-specific)
	/^packages\/config\/coverage\//,
	/^packages\/config\/src\/.*\.test\.js$/,

	// Playground: monorepo reference only - scaffolded conditionally via CLI when ui is selected
	/^apps\/web\/src\/app\/playground\//,

	// Bookings: monorepo-only feature (package not published to npm)
	/^apps\/web\/src\/app\/book\//,
];

/**
 * Template-only paths (relative to templates/) - never overwritten by sync.
 * These are generation templates (with __PLACEHOLDER__ variables),
 * scaffolding-specific configs, or manually curated starter files.
 */
const TEMPLATE_ONLY = new Set([
	// Copilot skill with __QUARK_SCOPE__ placeholders - generation template
	"base-project/.github/skills/project-context/SKILL.md",
	// Template-specific copilot instructions (with __QUARK_*__ placeholders + inline conventions)
	"base-project/.github/copilot-instructions.md",
	// Claude Code context file (with __QUARK_*__ placeholders) - generation template
	"base-project/CLAUDE.md",
	// Cursor rules (with __QUARK_*__ placeholders) - generation template
	"base-project/.cursor/rules/quark.mdc",
	// GitHub CI/CD workflows - scaffolded projects have their own pipelines
	"base-project/.github/workflows/ci.yml",
	"base-project/.github/workflows/release.yml",
	"base-project/.github/workflows/dependabot-auto-merge.yml",
	// Dependabot config - scaffolded projects have a simpler version
	"base-project/.github/dependabot.yml",
	// Scaffold starter README (different from monorepo README)
	"base-project/README.md",
	// Template .gitignore (includes .env, .next, etc.)
	"base-project/.gitignore",
	// Root package.json with @myquark scope placeholder
	"base-project/package.json",
	// Biome config - template has Tailwind CSS support and scoped file includes
	"base-project/biome.json",
	"base-project/apps/web/biome.json",
	// Migrations: template maintains its own squashed initial migration
	"base-project/packages/db/prisma/migrations",
	// Doctor and prepare scripts are hand-authored for scaffolded projects
	"base-project/scripts/doctor.js",
	"base-project/scripts/prepare.js",
	// Base-project sitemap is a simpler version (no CMS dependency);
	// the CMS-capable sitemap lives in cms-public template
	"base-project/apps/web/src/app/sitemap.js",

	// OpenCode deploy config - scaffolded conditionally via --features ai
	"opencode",
]);

// ─── Transforms ────────────────────────────────────────────────────────────────

/**
 * Per-file transforms applied AFTER copying from monorepo source.
 * Key: destination path relative to templates/. Value: (content, srcPath) → content.
 *
 * These handle structural differences between monorepo packages (which use
 * workspace:* for everything) and scaffold templates (which install
 * @techstream/quark-core from npm and use specific naming conventions).
 */
const TRANSFORMS = {
	"base-project/.dockerignore": transformScaffoldDockerIgnore,
	// Apps: adjust dependency references for scaffold context
	"base-project/apps/web/package.json": transformWebPackageJson,
	"base-project/apps/web/next.config.js": transformWebNextConfig,
	"worker/package.json": transformWorkerPackageJson,
	// DB: remove private flag for scaffold context
	"base-project/packages/db/package.json": transformDbPackageJson,
	// DB: prisma.config.js uses simple defaults for new projects
	"base-project/packages/db/prisma.config.js": transformPrismaConfig,
	// Optional packages: use @myquark placeholder scope
	"config/package.json": transformOptionalPackageJson,
	"ui/package.json": transformOptionalPackageJson,
	"jobs/package.json": transformOptionalPackageJson,
	"admin/package.json": transformOptionalPackageJson,
	"cms/package.json": transformOptionalPackageJson,
	"ai/package.json": transformOptionalPackageJson,
};

function transformScaffoldDockerIgnore(content) {
	const lines = content
		.split(/\r?\n/)
		.filter(
			(line) =>
				line.trim() !== "tmp-test-project" &&
				line.trim() !== "packages/cli/templates",
		);

	return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function transformWebPackageJson(content) {
	const pkg = JSON.parse(content);

	// Use @myquark placeholder scope (CLI replaces with user's scope)
	pkg.name = "@myquark/web";

	// Template test script doesn't have integration test exclusion
	if (pkg.scripts?.test) {
		pkg.scripts.test = "node --test 'src/**/*.test.js'";
	}
	// Remove monorepo-only scripts
	delete pkg.scripts?.["test:integration"];

	// Bookings is a monorepo-only package (not published to npm)
	delete pkg.dependencies?.["@techstream/quark-bookings"];

	// Core is installed from npm (not workspace) in scaffolded projects
	if (pkg.dependencies?.["@techstream/quark-core"]) {
		pkg.dependencies["@techstream/quark-core"] = CORE_VERSION_PIN;
	}
	// Config moves from dependencies to devDependencies in template
	if (pkg.dependencies?.["@techstream/quark-config"]) {
		delete pkg.dependencies["@techstream/quark-config"];
		pkg.devDependencies = pkg.devDependencies || {};
		pkg.devDependencies["@techstream/quark-config"] = "workspace:*";
	}

	return `${JSON.stringify(pkg, null, "\t")}\n`;
}

function transformWebNextConfig(content) {
	// Remove bookings reference (monorepo-only package, not published to npm)
	return content.replace(/^\t\t"@techstream\/quark-bookings",\n/gm, "");
}

function transformWorkerPackageJson(content) {
	const pkg = JSON.parse(content);

	// Use @myquark placeholder scope (CLI replaces with user's scope)
	pkg.name = "@myquark/worker";

	// Core is installed from npm (not workspace) in scaffolded projects
	if (pkg.dependencies?.["@techstream/quark-core"]) {
		pkg.dependencies["@techstream/quark-core"] = CORE_VERSION_PIN;
	}

	// Replace bash subshell glob with a cross-platform Node.js native glob
	// so `pnpm test` works on Windows (cmd.exe/PowerShell) as well as Unix.
	if (pkg.scripts?.test) {
		pkg.scripts.test = "node --test 'src/**/*.test.js'";
	}

	return `${JSON.stringify(pkg, null, "\t")}\n`;
}

function transformDbPackageJson(content) {
	const pkg = JSON.parse(content);

	// Use @myquark placeholder scope (CLI replaces with user's scope)
	pkg.name = "@myquark/db";

	// Remove private flag - scaffolded packages use custom scope
	delete pkg.private;

	// Core is installed from npm (not workspace) in scaffolded projects
	if (pkg.dependencies?.["@techstream/quark-core"]) {
		pkg.dependencies["@techstream/quark-core"] = CORE_VERSION_PIN;
	}

	// DB tests need a generated Prisma client on fresh installs, and the Node.js
	// native glob keeps the scaffold script cross-platform.
	if (pkg.scripts?.test) {
		pkg.scripts.test = "pnpm run db:generate && node --test 'src/**/*.test.js'";
	}

	return `${JSON.stringify(pkg, null, "\t")}\n`;
}

function transformPrismaConfig(content) {
	// Template now uses the shared getConnectionString() import (same as monorepo).
	// No transformation needed - both versions use identical code.
	return content;
}

function transformOptionalPackageJson(content) {
	const pkg = JSON.parse(content);

	// Use @myquark placeholder scope (CLI replaces with user's scope)
	const shortName = extractShortName(pkg.name);
	pkg.name = `@myquark/${shortName}`;

	// Remove private flag
	delete pkg.private;

	// Remove monorepo-only fields
	delete pkg.description;
	delete pkg.keywords;
	delete pkg.author;
	delete pkg.license;
	delete pkg.packageManager;
	delete pkg.types;

	// Remove scripts (optional packages in templates are minimal)
	delete pkg.scripts;

	// Core is installed from npm (not workspace) in scaffolded projects.
	if (pkg.dependencies?.["@techstream/quark-core"]) {
		pkg.dependencies["@techstream/quark-core"] = CORE_VERSION_PIN;
	}

	// Remove devDependencies that are monorepo workspace refs
	if (pkg.devDependencies) {
		for (const dep of Object.keys(pkg.devDependencies)) {
			if (dep.startsWith("@techstream/quark-")) {
				delete pkg.devDependencies[dep];
			}
		}
		if (Object.keys(pkg.devDependencies).length === 0) {
			delete pkg.devDependencies;
		}
	}

	return `${JSON.stringify(pkg, null, "\t")}\n`;
}

/**
 * Extract the short package name (e.g. "ui" from "@techstream/quark-ui")
 */
function extractShortName(fullName) {
	const lastSegment = fullName.split("/").pop();
	return lastSegment.replace(/^quark-/, "");
}

// ─── Sync Engine ───────────────────────────────────────────────────────────────

/**
 * Check if a source path (relative to repo root) should be excluded
 */
function isExcluded(srcRelative) {
	return EXCLUDE_PATTERNS.some((pattern) => pattern.test(srcRelative));
}

/**
 * Check if a template path (relative to templates/) is template-only
 */
function isTemplateOnly(templateRelative) {
	for (const entry of TEMPLATE_ONLY) {
		if (
			templateRelative === entry ||
			templateRelative.startsWith(`${entry}/`)
		) {
			return true;
		}
	}
	return false;
}

/**
 * Recursively collect all files in a directory
 * @returns {string[]} Array of paths relative to `dir`
 */
function collectFiles(dir, prefix = "") {
	const entries = [];
	if (!fs.existsSync(dir)) return entries;

	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			entries.push(...collectFiles(path.join(dir, entry.name), rel));
		} else {
			entries.push(rel);
		}
	}
	return entries;
}

/**
 * Compute SHA-256 hash of file contents for comparison
 */
function fileHash(filePath) {
	if (!fs.existsSync(filePath)) return null;
	const content = fs.readFileSync(filePath);
	return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Sync a single file from source to destination, applying transforms.
 * @returns {{ action: string, file: string } | null}
 */
function syncFile(srcPath, destPath, destRelative) {
	let content = fs.readFileSync(srcPath, "utf-8");

	// Apply transform if one exists for this destination
	const transform = TRANSFORMS[destRelative];
	if (transform) {
		content = transform(content, srcPath);
	}

	// Check if file already exists and is identical
	if (fs.existsSync(destPath)) {
		const existing = fs.readFileSync(destPath, "utf-8");
		if (existing === content) {
			return null; // No change needed
		}
	}

	const action = fs.existsSync(destPath) ? "updated" : "created";

	if (!CHECK_MODE) {
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.writeFileSync(destPath, content);
	}

	return { action, file: destRelative };
}

/**
 * Sync a binary file (images, etc.) from source to destination.
 * @returns {{ action: string, file: string } | null}
 */
function syncBinaryFile(srcPath, destPath, destRelative) {
	const srcHash = fileHash(srcPath);
	const destHash = fileHash(destPath);

	if (srcHash === destHash) return null;

	const action = fs.existsSync(destPath) ? "updated" : "created";

	if (!CHECK_MODE) {
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.copyFileSync(srcPath, destPath);
	}

	return { action, file: destRelative };
}

/**
 * Check if a file is likely binary
 */
function isBinaryFile(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	return [
		".ico",
		".png",
		".jpg",
		".jpeg",
		".gif",
		".woff",
		".woff2",
		".ttf",
		".eot",
	].includes(ext);
}

/**
 * Sync a directory mapping: copy all non-excluded source files to template dest.
 * Also removes stale files from template that no longer exist in source.
 */
function syncDirectory(mapping) {
	const srcDir = path.join(ROOT, mapping.src);
	const destDir = path.join(TEMPLATES, mapping.dest);
	const changes = [];

	// Collect source files (relative to srcDir)
	const sourceFiles = collectFiles(srcDir);

	// Copy/update source files → template
	for (const rel of sourceFiles) {
		const srcRelativeToRoot = `${mapping.src}/${rel}`;

		if (isExcluded(srcRelativeToRoot)) continue;
		if (mapping.localExcludes?.some((p) => p.test(srcRelativeToRoot))) continue;

		const destRelative = `${mapping.dest}/${rel}`;
		if (isTemplateOnly(destRelative)) continue;

		const srcPath = path.join(srcDir, rel);
		const destPath = path.join(destDir, rel);

		const change = isBinaryFile(rel)
			? syncBinaryFile(srcPath, destPath, destRelative)
			: syncFile(srcPath, destPath, destRelative);

		if (change) changes.push(change);
	}

	// Clean stale files: files in template that don't exist in source
	// (but only within synced directories, and only non-template-only files)
	const templateFiles = collectFiles(destDir);
	for (const rel of templateFiles) {
		const destRelative = `${mapping.dest}/${rel}`;
		if (isTemplateOnly(destRelative)) continue;

		const srcRelativeToRoot = `${mapping.src}/${rel}`;

		// If excluded, it's expected to NOT be in source - don't delete from template
		// (template may have its own version of excluded files, like migrations)
		if (isExcluded(srcRelativeToRoot)) continue;
		if (mapping.localExcludes?.some((p) => p.test(srcRelativeToRoot))) continue;

		const srcPath = path.join(srcDir, rel);
		if (!fs.existsSync(srcPath)) {
			if (!CHECK_MODE) {
				const filePath = path.join(destDir, rel);
				fs.unlinkSync(filePath);
				// Clean up empty parent directories
				let parent = path.dirname(filePath);
				while (parent !== destDir) {
					if (fs.readdirSync(parent).length === 0) {
						fs.rmdirSync(parent);
						parent = path.dirname(parent);
					} else {
						break;
					}
				}
			}
			changes.push({ action: "deleted", file: destRelative });
		}
	}

	return changes;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

/**
 * In pre-commit mode, check if any staged files touch source directories.
 * If not, skip sync entirely for fast commits.
 */
function shouldSyncForPreCommit() {
	try {
		const staged = execSync("git diff --cached --name-only", {
			cwd: ROOT,
			encoding: "utf-8",
		});
		const sourceDirPattern =
			/^(scripts\/|apps\/|packages\/(db|config|ui|jobs|admin|opencode)\/|turbo\.json|docker-compose(\.override)?\.yml|pnpm-workspace\.yaml)/;
		return staged.split("\n").some((f) => sourceDirPattern.test(f));
	} catch {
		return false;
	}
}

function main() {
	// Pre-commit: skip sync if no relevant files are staged
	if (PRE_COMMIT_MODE && !shouldSyncForPreCommit()) {
		process.exit(0);
	}

	console.log(
		CHECK_MODE
			? "🔍 Checking template drift...\n"
			: "🔄 Syncing templates from monorepo source...\n",
	);

	const allChanges = [];

	// Sync directory mappings
	for (const mapping of SYNC_DIRS) {
		const changes = syncDirectory(mapping);
		allChanges.push(...changes);
	}

	// Sync individual file mappings
	for (const mapping of SYNC_FILES) {
		const srcPath = path.join(ROOT, mapping.src);
		const destPath = path.join(TEMPLATES, mapping.dest);

		if (isTemplateOnly(mapping.dest)) continue;

		const change = syncFile(srcPath, destPath, mapping.dest);
		if (change) allChanges.push(change);
	}

	// Report results
	if (allChanges.length === 0) {
		validateTemplateMigration();
		console.log("✅ Templates are in sync with monorepo source.\n");
		process.exit(0);
	}

	const created = allChanges.filter((c) => c.action === "created");
	const updated = allChanges.filter((c) => c.action === "updated");
	const deleted = allChanges.filter((c) => c.action === "deleted");

	if (CHECK_MODE) {
		console.log(
			`❌ Template drift detected: ${allChanges.length} file(s) would change.\n`,
		);
	} else {
		console.log(`📦 Synced ${allChanges.length} file(s):\n`);
	}

	if (created.length > 0) {
		console.log(`  Created (${created.length}):`);
		for (const c of created) console.log(`    + ${c.file}`);
	}
	if (updated.length > 0) {
		console.log(`  Updated (${updated.length}):`);
		for (const c of updated) console.log(`    ~ ${c.file}`);
	}
	if (deleted.length > 0) {
		console.log(`  Deleted (${deleted.length}):`);
		for (const c of deleted) console.log(`    - ${c.file}`);
	}

	console.log("");
	validateTemplateMigration();

	if (CHECK_MODE) {
		process.exit(1);
	}

	// Pre-commit: stage synced template files
	if (PRE_COMMIT_MODE) {
		execSync("git add packages/cli/templates/", { cwd: ROOT });
	}
}

main();
