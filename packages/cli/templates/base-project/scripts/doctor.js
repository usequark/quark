#!/usr/bin/env node
/**
 * scripts/doctor.js
 *
 * Audits this project for unfinished post-scaffold customisation.
 * Run it at any time - it is safe, read-only by default.
 *
 * Usage:
 *   pnpm doctor          # Audit only
 *   pnpm doctor:fix      # Audit + auto-remove Quark aesthetic scaffolding
 *   pnpm doctor:ci       # CI-safe checks only (no .env, exits 1 on errors)
 *
 * Extend the CHECKS array below to add your own project-specific rules.
 * This script has zero external dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIX = process.argv.includes("--fix");
const CI = process.argv.includes("--ci");

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const c = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
};

const fmt = {
	bold: (s) => `${c.bold}${s}${c.reset}`,
	dim: (s) => `${c.dim}${s}${c.reset}`,
	red: (s) => `${c.red}${s}${c.reset}`,
	green: (s) => `${c.green}${s}${c.reset}`,
	yellow: (s) => `${c.yellow}${s}${c.reset}`,
	blue: (s) => `${c.blue}${s}${c.reset}`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function exists(rel) {
	return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
	const abs = path.join(ROOT, rel);
	return fs.existsSync(abs) ? fs.readFileSync(abs, "utf-8") : null;
}

/** Remove a file or directory tree (relative to ROOT). */
function remove(rel) {
	const abs = path.join(ROOT, rel);
	fs.rmSync(abs, { recursive: true, force: true });
}

/** Write content to a file (relative to ROOT), creating parent dirs as needed. */
function write(rel, content) {
	const abs = path.join(ROOT, rel);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, content, "utf-8");
}

/**
 * Recursively find source files under `dir` that contain `importString`.
 * Returns an array of absolute file paths.
 */
function findImports(dir, importString) {
	const results = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".next") {
			results.push(...findImports(full, importString));
		} else if (entry.isFile() && /\.(js|jsx|ts|tsx|mjs)$/.test(entry.name)) {
			const content = fs.readFileSync(full, "utf-8");
			if (content.includes(importString)) {
				results.push(full);
			}
		}
	}
	return results;
}

// ─── Finding model ────────────────────────────────────────────────────────────

/**
 * @typedef {{ category: string, status: 'error'|'warn'|'info', key: string,
 *             message: string, detail: string, fix: string, fixable: boolean }} Finding
 */

/** @type {Finding[]} */
const findings = [];

function warn(key, category, message, detail, fix, fixable = false) {
	findings.push({ category, status: "warn", key, message, detail, fix, fixable });
}

function error(key, category, message, detail, fix, fixable = false) {
	findings.push({ category, status: "error", key, message, detail, fix, fixable });
}

function info(key, category, message, detail, fix) {
	findings.push({ category, status: "info", key, message, detail, fix, fixable: false });
}

// ─── Checks ───────────────────────────────────────────────────────────────────

// Read .quark-link.json to understand what packages were included at scaffold time.
const quarkLink = (() => {
	try {
		return JSON.parse(read(".quark-link.json") ?? "{}");
	} catch {
		return {};
	}
})();
const hasUI = Array.isArray(quarkLink.packages) && quarkLink.packages.includes("ui");
const installedPackages = Array.isArray(quarkLink.packages) ? quarkLink.packages : [];

// ── Structural checks (always run - safe in CI without .env) ─────────────────

// ── Check S1: app/page.js conflicts with a route group ────────────────────────
const rootPagePath = "apps/web/src/app/page.js";
const appDir = path.join(ROOT, "apps/web/src/app");
if (exists(rootPagePath) && fs.existsSync(appDir)) {
	const routeGroups = fs
		.readdirSync(appDir, { withFileTypes: true })
		.filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name))
		.map((e) => `  apps/web/src/app/${e.name}/`);

	if (routeGroups.length > 0) {
		error(
			"page-route-conflict",
			"routing",
			"apps/web/src/app/page.js conflicts with a route group - Next.js will fail to build",
			routeGroups.join("\n"),
			"Delete apps/web/src/app/page.js and move its content into the route group's page.js",
		);
	}
}

// ── Check S2: Forgot-password page is a placeholder stub ──────────────────────
const forgotPwContent = read("apps/web/src/app/auth/forgot-password/page.js");
if (forgotPwContent && forgotPwContent.includes("quark-auth-layout")) {
	warn(
		"forgot-password-stub",
		"security",
		"Forgot-password page is a scaffold stub - users cannot reset their password",
		"apps/web/src/app/auth/forgot-password/page.js",
		"Implement a password reset flow (email token) before going to production, or remove this route",
	);
}

// ── Check S3: Source files import packages not installed ───────────────────────
{
	const optionalPackages = ["ui", "jobs"];
	const scope = (() => {
		try {
			const pkg = JSON.parse(read("package.json") ?? "{}");
			const m = pkg.name?.match(/^@([^/]+)\//);
			return m ? m[1] : null;
		} catch {
			return null;
		}
	})();

	if (scope) {
		const missingPkgs = optionalPackages.filter(
			(p) => !installedPackages.includes(p),
		);
		for (const pkg of missingPkgs) {
			const importPattern = `@${scope}/${pkg}`;
			const srcDir = path.join(ROOT, "apps/web/src");
			if (fs.existsSync(srcDir)) {
				const badFiles = findImports(srcDir, importPattern);
				if (badFiles.length > 0) {
					error(
						`orphan-import-${pkg}`,
						"imports",
						`Source files import "${importPattern}" but "${pkg}" is not installed`,
						badFiles.map((f) => `  ${path.relative(ROOT, f)}`).join("\n"),
						`Remove these imports or run: npx @usequark/quark-create-app add ${pkg}`,
					);
				}
			}
		}
	}
}

// ── Check S4: .quark-link.json missing ────────────────────────────────────────
if (!exists(".quark-link.json")) {
	warn(
		"quark-link-missing",
		"configuration",
		".quark-link.json is missing - Quark CLI commands (update, add) will not work",
		"",
		"If this is a Quark project, restore .quark-link.json from git history",
	);
}

// ── Check S5: .env.example contains placeholder scaffold values ───────────────
const exampleContent = read(".env.example");
if (exampleContent) {
	const descLine = exampleContent.match(/^APP_DESCRIPTION=(.+)$/m);
	const descVal = descLine?.[1]?.trim() ?? "";
	if (/\bapplication\b$/i.test(descVal) && descVal.split(" ").length <= 3) {
		warn(
			"generic-description",
			"metadata",
			"APP_DESCRIPTION in .env.example is still a generic scaffold value",
			`.env.example → APP_DESCRIPTION="${descVal}"`,
			"Update APP_DESCRIPTION in .env.example to describe your actual project",
		);
	}
}

// ── Check S6: README branding block is still the Quark default ───────────────
{
	const readmeForBranding = read("README.md");
	if (readmeForBranding) {
		const staleBranding = [];

		// The scaffold ships the Quark mark as a stand-in logo; it resolves
		// (unlike a missing file) but it is Quark's brand, not the user's.
		if (/src="[^"]*quark\.svg"/i.test(readmeForBranding)) {
			staleBranding.push(
				"README.md → logo still points at apps/web/public/quark.svg (the Quark mark)",
			);
		}

		// Mirrors the S5 heuristic: a tagline that is only "<name> application"
		// is the default the CLI seeds from the project name, not a real one.
		const tagline =
			readmeForBranding.match(/<strong>(.*?)<\/strong>/)?.[1]?.trim() ?? "";
		if (/\bapplication\b$/i.test(tagline) && tagline.split(/\s+/).length <= 3) {
			staleBranding.push(
				`README.md → tagline is still the scaffold default: "${tagline}"`,
			);
		}

		if (staleBranding.length > 0) {
			warn(
				"readme-branding",
				"branding",
				"README branding block is still the Quark default",
				staleBranding.join("\n"),
				"Swap apps/web/public/quark.svg for your own logo (keep the filename so the PWA icon keeps working) and rewrite the tagline to describe your app",
			);
		}
	}
}

// ── Environment-dependent checks (skipped in CI mode) ─────────────────────────

if (!CI) {

// ── Check E1: Quark home scaffold still present ───────────────────────────────
const homeScaffoldFiles = [
	"apps/web/src/app/_components/QuarkAnimation.js",
	"apps/web/src/app/_components/HealthIndicator.js",
	"apps/web/src/app/_components/HomeThemeToggle.js",
].filter(exists);

if (homeScaffoldFiles.length > 0) {
	warn(
		"quark-home-scaffold",
		"branding",
		"Quark home scaffold components are still present",
		homeScaffoldFiles.join("\n"),
		"Replace these with your own hero content and update apps/web/src/app/page.js",
		true,
	);
}

// ── Check E2: Quark layout scaffold still present ─────────────────────────────
if (exists("apps/web/src/app/layout/_components/FloatingThemeToggle.js")) {
	warn(
		"quark-layout-scaffold",
		"branding",
		"Quark layout scaffold component is still present (FloatingThemeToggle)",
		"apps/web/src/app/layout/_components/FloatingThemeToggle.js",
		"Replace or remove the floating theme toggle and update the root layout with your own design",
		true,
	);
}

// ── Check E4: APP_NAME / APP_DESCRIPTION still reference "Quark" ──────────────
const envContent = read(".env");
if (envContent) {
	const nameMatch = envContent.match(/^APP_NAME=(.+)$/m);
	const descMatch = envContent.match(/^APP_DESCRIPTION=(.+)$/m);
	const nameVal = nameMatch?.[1]?.trim() ?? "";
	const descVal = descMatch?.[1]?.trim() ?? "";

	if (/\bquark\b/i.test(nameVal) || /\bquark\b/i.test(descVal)) {
		warn(
			"app-identity",
			"metadata",
			'APP_NAME or APP_DESCRIPTION still references "Quark"',
			`.env → APP_NAME="${nameVal}", APP_DESCRIPTION="${descVal}"`,
			"Update APP_NAME and APP_DESCRIPTION in your .env to match your project",
		);
	}
}

// ── Check E5: Placeholder secrets (CHANGE_ME) left in .env ───────────────────
if (envContent && envContent.includes("CHANGE_ME")) {
	const lines = envContent
		.split("\n")
		.map((l, i) => ({ line: i + 1, text: l }))
		.filter(({ text }) => text.includes("CHANGE_ME"))
		.map(({ line, text }) => `  line ${line}: ${text.split("=")[0]}`);

	error(
		"secrets",
		"security",
		"CHANGE_ME placeholders found in .env - rotate these before deploying",
		lines.join("\n"),
		"Replace every CHANGE_ME value with a real secret",
	);
}

// ── Check E6: .env missing vars that exist in .env.example ───────────────────
if (envContent && exampleContent) {
	const defined = new Set(
		envContent
			.split("\n")
			.filter((l) => l.includes("=") && !l.startsWith("#"))
			.map((l) => l.split("=")[0].trim()),
	);
	const missing = exampleContent
		.split("\n")
		.filter((l) => l.includes("=") && !l.startsWith("#"))
		.map((l) => l.split("=")[0].trim())
		.filter((k) => k && !defined.has(k));

	if (missing.length > 0) {
		warn(
			"env-missing",
			"configuration",
			`.env.example defines ${missing.length} key(s) not present in .env`,
			missing.map((k) => `  ${k}`).join("\n"),
			"Add the missing keys to your .env (copy from .env.example and fill in values)",
		);
	}
}

// ── Check E7: README still contains Quark template content ───────────────────
const readmeContent = read("README.md");
if (readmeContent) {
	// Strip the invisible scaffold-metadata comment and the default logo src -
	// check S6 owns the branding block. What is left is Quark references the
	// author actually wrote into the README content.
	const visibleReadme = readmeContent
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/src="[^"]*quark\.svg"/gi, "");
	if (/quark/i.test(visibleReadme)) {
		info(
			"readme",
			"documentation",
			"README.md still contains references to Quark",
			"README.md",
			"Update the README to describe your own project",
		);
	}
}

} // end if (!CI)

// ─── --fix: auto-remove fixable items ────────────────────────────────────────

const STATUS_ICON = { error: "✗", warn: "⚠", info: "·" };
const STATUS_COLOR = { error: fmt.red, warn: fmt.yellow, info: fmt.dim };

// Print the report first so users see what was found before anything is changed.
console.log(fmt.bold(fmt.blue(`\n🩺 Quark Doctor${CI ? " (CI)" : ""}\n`)));

if (findings.length === 0) {
	console.log(fmt.green("  ✓ Nothing to do - project looks clean!\n"));
	process.exit(0);
}

// Group by category
const categories = [...new Set(findings.map((f) => f.category))];
for (const cat of categories) {
	console.log(fmt.bold(`  ${cat}`));
	for (const f of findings.filter((f) => f.category === cat)) {
		const icon = STATUS_ICON[f.status];
		const colorFn = STATUS_COLOR[f.status];
		console.log(`    ${colorFn(`${icon} ${f.message}`)}`);
		if (f.detail) {
			for (const line of f.detail.split("\n")) {
				console.log(fmt.dim(`      ${line}`));
			}
		}
		if (!FIX || !f.fixable) {
			console.log(fmt.dim(`      → ${f.fix}`));
		}
	}
	console.log();
}

const errorCount = findings.filter((f) => f.status === "error").length;
const warnCount = findings.filter((f) => f.status === "warn").length;
const fixableCount = findings.filter((f) => f.fixable).length;

const parts = [];
if (errorCount) parts.push(fmt.red(`${errorCount} error${errorCount > 1 ? "s" : ""}`));
if (warnCount) parts.push(fmt.yellow(`${warnCount} warning${warnCount > 1 ? "s" : ""}`));
console.log(fmt.bold(`  Summary: ${parts.join(", ")}`));

if (FIX && !CI) {
	const fixable = findings.filter((f) => f.fixable);
	if (fixable.length === 0) {
		console.log(fmt.dim("  No auto-fixable items found.\n"));
	} else {
		console.log(fmt.bold(fmt.blue("\n🔧 Applying fixes…\n")));
		for (const f of fixable) {
			if (f.key === "quark-home-scaffold") {
				for (const file of homeScaffoldFiles) {
					remove(file);
					console.log(fmt.green(`  ✓ Removed ${file}`));
				}
				// Replace page.js with a minimal stub so removed imports no longer crash the build
				write(
					"apps/web/src/app/page.js",
					`export default function Home() {\n\treturn <main>Hello world</main>;\n}\n`,
				);
				console.log(fmt.green("  ✓ Replaced apps/web/src/app/page.js with a minimal stub"));
			} else if (f.key === "quark-layout-scaffold") {
				remove("apps/web/src/app/layout/_components");
				console.log(fmt.green("  ✓ Removed apps/web/src/app/layout/_components/"));
			}
		}
		console.log();
	}
} else if (fixableCount > 0) {
	console.log(
		fmt.dim(`  ${fixableCount} item(s) can be auto-removed with: pnpm doctor:fix\n`),
	);
} else {
	console.log();
}

if (errorCount > 0) process.exit(1);
