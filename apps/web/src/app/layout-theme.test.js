import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Issue #6: `layout.js` never mounted `ThemeProvider`, so `useTheme()` resolved
 * to its context default and every `ThemeToggle` in the tree rendered a button
 * that changed nothing. Nothing threw, so the defect was invisible.
 *
 * The behavioural proof lives in `packages/ui/src/theme.test.js`. This file pins
 * the wiring that makes the behaviour reachable, and reads the source rather
 * than importing it: `layout.js` imports `globals.css` and Next-only modules,
 * which `node --test` cannot resolve.
 *
 * Verified to fail when the `ThemeProvider` wrapper is removed from `layout.js`.
 */

const layoutUrl = new URL("./layout.js", import.meta.url);

async function readLayout() {
	return readFile(layoutUrl, "utf8");
}

test("RootLayout mounts ThemeProvider around the app tree", async () => {
	const source = await readLayout();

	assert.match(
		source,
		/import\s*\{[^}]*\bThemeProvider\b[^}]*\}\s*from\s*["']@usequark\/quark-ui["']/,
		"layout.js must import ThemeProvider from the ui package",
	);

	assert.match(
		source,
		/<ThemeProvider>\s*\{children\}\s*<\/ThemeProvider>/,
		"children must be wrapped in ThemeProvider",
	);
});

test("RootLayout keeps the pre-paint theme script", async () => {
	const source = await readLayout();

	// Mounting the provider must not replace the blocking script: the provider
	// only syncs in a layout effect, i.e. after the first paint.
	assert.match(
		source,
		/dangerouslySetInnerHTML=\{\{ __html: themeScript \}\}/,
		"the FOUC-prevention script must stay in <head>",
	);
	assert.match(source, /suppressHydrationWarning/);
});
