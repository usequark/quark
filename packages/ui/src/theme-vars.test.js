import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Every `utility-(--name)` / `[var(--name)]` class string and inline
 * `var(--name)` style value in this package is a hard dependency on a custom
 * property being defined by the consuming project's CSS. Tailwind v4 resolves
 * these at build time, so a renamed or deleted variable does not throw - it
 * compiles and then silently renders unstyled. That is how the class-string
 * bugs fixed in #217 shipped: nothing failed, nothing warned.
 *
 * These assertions are static, so they need no jsdom/React and run under the
 * plain `node --test` collection in scripts/run-tests.mjs.
 *
 * Monorepo-only: sync-templates.js excludes packages/ui/src/*.test.js and
 * packages/ui/themes/, so nothing here ships into a scaffolded project.
 */

const SRC_DIR = import.meta.dirname;
const UI_ROOT = path.resolve(SRC_DIR, "..");
const REPO_ROOT = path.resolve(UI_ROOT, "../..");
const GLOBALS_CSS = path.join(REPO_ROOT, "apps/web/src/app/globals.css");
const THEMES_DIR = path.join(UI_ROOT, "themes");

/**
 * Tailwind v4 emits an arbitrary-property class for any utility when the
 * value is wrapped in `(--var)`: `bg-(--card-bg)` -> `background-color:
 * var(--card-bg)`. The long form `bg-[var(--card-bg)]` is also in use.
 */
const CLASS_VAR = /(?:^|[^\w-])([a-z][\w-]*?)-\(--([a-zA-Z0-9-]+)\)/g;
const ARBITRARY_VALUE_VAR =
	/\[\s*var\(\s*--([a-zA-Z0-9-]+)\s*(?:,[^)\]]*)?\)\s*\]/g;

/**
 * Collect every CSS custom property a component file depends on.
 * @returns {Map<string, string[]>} var name -> human-readable call sites
 */
function collectUsedVars(source, label) {
	const sites = new Map();
	const record = (name, form, index) => {
		if (!sites.has(name)) sites.set(name, []);
		// Derive the line from the match offset, not indexOf(name) - the first
		// occurrence of a name is not necessarily the one being reported.
		const line = source.slice(0, index).split("\n").length;
		sites.get(name).push(`${label}:${line} ${form}`);
	};

	for (const match of source.matchAll(CLASS_VAR)) {
		record(match[2], `${match[1]}-(--${match[2]})`, match.index);
	}
	for (const match of source.matchAll(ARBITRARY_VALUE_VAR)) {
		record(match[1], `[var(--${match[1]})]`, match.index);
	}
	return sites;
}

/** Custom properties declared in a stylesheet. */
function collectDefinedVars(css) {
	const defined = new Set();
	for (const match of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
		defined.add(match[1].slice(2));
	}
	return defined;
}

function readComponentFiles() {
	return fs
		.readdirSync(SRC_DIR)
		.filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"))
		.sort()
		.map((name) => path.join(SRC_DIR, name));
}

const componentFiles = readComponentFiles();
const usedVars = new Map();
for (const file of componentFiles) {
	const source = fs.readFileSync(file, "utf-8");
	for (const [name, sites] of collectUsedVars(source, path.basename(file))) {
		usedVars.set(name, [...(usedVars.get(name) ?? []), ...sites]);
	}
}

describe("theme-var class strings", () => {
	it("finds the components to scan", () => {
		// Guards the extractor itself: if this glob silently stops matching, every
		// assertion below would pass green against zero inputs.
		assert.ok(
			componentFiles.length > 10,
			`expected the component source files, found ${componentFiles.length}`,
		);
	});

	it("finds CSS variables referenced by components", () => {
		assert.ok(
			usedVars.size > 50,
			`expected many theme-var class strings, found ${usedVars.size} - the extractor is probably broken`,
		);
	});

	it("declares every CSS variable a component class string references", () => {
		const defined = collectDefinedVars(fs.readFileSync(GLOBALS_CSS, "utf-8"));
		const missing = [...usedVars]
			.filter(([name]) => !defined.has(name))
			.map(([name, sites]) => `  --${name}  (e.g. ${sites[0]})`);

		assert.deepEqual(
			missing,
			[],
			`${missing.length} theme-var class strings reference a variable ${path.relative(REPO_ROOT, GLOBALS_CSS)} never declares.\nA Tailwind var class for an undefined property compiles and renders unstyled, so this must fail here instead:\n${missing.join("\n")}`,
		);
	});

	it("ships a theme that overrides every CSS variable components reference", () => {
		const themes = fs
			.readdirSync(THEMES_DIR)
			.filter((name) => name.endsWith(".css"))
			.sort();

		assert.ok(themes.length > 0, "expected curated theme stylesheets");

		const gaps = [];
		for (const theme of themes) {
			const defined = collectDefinedVars(
				fs.readFileSync(path.join(THEMES_DIR, theme), "utf-8"),
			);
			for (const name of usedVars.keys()) {
				if (!defined.has(name)) gaps.push(`  ${theme}: --${name}`);
			}
		}

		assert.deepEqual(
			gaps,
			[],
			`${gaps.length} theme variable(s) are missing from at least one theme in packages/ui/themes.\nA partial theme inherits the base value for the rest, so the theme is incoherent rather than broken - pin it here:\n${gaps.join("\n")}`,
		);
	});
});
