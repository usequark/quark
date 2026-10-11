import assert from "node:assert";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE_PATH = path.join(__dirname, "page.js");

// This file used to assert `assert.ok("Quark")` and `assert.strictEqual(true,
// true)` — both tautologies that pass regardless of what the page renders, so
// they could never catch a regression and gave the page false coverage.
//
// The page is tested against its source rather than by rendering it, because
// rendering is not possible here: `tsx` (which `run-tests.mjs` uses via
// `--import tsx/esm`) cannot parse any of the JSX page components under
// `src/app/` — every one fails with a parse error — while Next.js compiles them
// through SWC, which is why the app builds and runs fine. A render test would
// therefore be unrunnable, not merely awkward. Reading the source is the same
// technique `manifest.test.js` uses for the root layout, and it asserts the
// one thing that actually matters: the links this page is responsible for are
// present in the JSX that ships.
//
// The `Home` component itself is what declares these links, so a change that
// drops one fails here and is caught in CI rather than shipping silently.
test("Home page declares its github and npm links", async () => {
	const source = await readFile(PAGE_PATH, "utf8");

	for (const href of [
		"https://github.com/usequark/quark",
		"https://www.npmjs.com/package/@usequark/quark-create-app",
	]) {
		assert.ok(
			source.includes(`href="${href}"`),
			`Home page is missing its link to ${href}`,
		);
	}
});
