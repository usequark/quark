#!/usr/bin/env node
/**
 * scripts/doctor.js
 *
 * Audits this project for unfinished post-scaffold customisation.
 * Run it at any time — it is safe, read-only by default.
 *
 * Usage:
 *   pnpm doctor          # Audit only
 *   pnpm doctor:fix      # Audit + auto-remove Quark aesthetic scaffolding
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

// ── Check 1: Quark Animation still present ────────────────────────────────────
if (exists("apps/web/src/app/_components/QuarkAnimation.js")) {
	warn(
		"quark-animation",
		"branding",
		"QuarkAnimation is still in the project",
		"apps/web/src/app/_components/QuarkAnimation.js",
		"Replace or remove the animation and update the home page with your own hero content",
		true,
	);
}

// ── Check 2: Playground page present (only relevant with UI package) ──────────
if (hasUI && exists("apps/web/src/app/playground")) {
	warn(
		"playground",
		"branding",
		"Playground page is still present",
		"apps/web/src/app/playground/",
		"Consider removing the playground before going to production",
		true,
	);
}

// ── Check 3: APP_NAME / APP_DESCRIPTION still reference "Quark" ───────────────
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

// ── Check 4: Placeholder secrets (CHANGE_ME) left in .env ────────────────────
if (envContent && envContent.includes("CHANGE_ME")) {
	const lines = envContent
		.split("\n")
		.map((l, i) => ({ line: i + 1, text: l }))
		.filter(({ text }) => text.includes("CHANGE_ME"))
		.map(({ line, text }) => `  line ${line}: ${text.split("=")[0]}`);

	error(
		"secrets",
		"security",
		"CHANGE_ME placeholders found in .env — rotate these before deploying",
		lines.join("\n"),
		"Replace every CHANGE_ME value with a real secret",
	);
}

// ── Check 5: .env missing vars that exist in .env.example ────────────────────
const exampleContent = read(".env.example");
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

// ── Check 6: README still contains Quark template content ────────────────────
const readmeContent = read("README.md");
if (readmeContent && /quark/i.test(readmeContent)) {
	info(
		"readme",
		"documentation",
		"README.md still contains references to Quark",
		"README.md",
		"Update the README to describe your own project",
	);
}

// ─── --fix: auto-remove fixable items ────────────────────────────────────────

const STATUS_ICON = { error: "✗", warn: "⚠", info: "·" };
const STATUS_COLOR = { error: fmt.red, warn: fmt.yellow, info: fmt.dim };

// Print the report first so users see what was found before anything is changed.
console.log(fmt.bold(fmt.blue("\n🩺 Quark Doctor\n")));

if (findings.length === 0) {
	console.log(fmt.green("  ✓ Nothing to do — project looks clean!\n"));
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

if (FIX) {
	const fixable = findings.filter((f) => f.fixable);
	if (fixable.length === 0) {
		console.log(fmt.dim("  No auto-fixable items found.\n"));
	} else {
		console.log(fmt.bold(fmt.blue("\n🔧 Applying fixes…\n")));
		for (const f of fixable) {
			if (f.key === "quark-animation") {
				remove("apps/web/src/app/_components/QuarkAnimation.js");
				console.log(fmt.green(`  ✓ Removed QuarkAnimation.js`));
			} else if (f.key === "playground") {
				remove("apps/web/src/app/playground");
				console.log(fmt.green(`  ✓ Removed apps/web/src/app/playground/`));
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
