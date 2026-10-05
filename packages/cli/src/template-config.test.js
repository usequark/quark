#!/usr/bin/env node

/**
 * Regression tests for the generated scaffold `biome.json`.
 *
 * The template used to ship `"root": false`. With that key Biome looks for a
 * root configuration in ancestor directories; a scaffolded project usually has
 * none, so Biome falls back to its built-in defaults and applies none of the
 * project's own config. Measured consequences in a fresh scaffold:
 *
 *   - `files.includes` negations stop excluding anything, so the Prisma client
 *     under `packages/db/src/generated` gets linted
 *   - `css.parser.tailwindDirectives` is unset, so every Tailwind at-rule in
 *     `globals.css` reports a parse error and formatting aborts
 *   - `pnpm lint` (turbo run lint → per-package biome check) exits non-zero
 *
 * `apps/web/biome.json` extends the root config, so it must keep `root: false`;
 * dropping it there makes Biome reject the setup as a nested root config.
 *
 * Run with: node --test packages/cli/src/template-config.test.js
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const TEMPLATES = path.join(import.meta.dirname, "..", "templates");
const readJson = (rel) =>
	JSON.parse(fs.readFileSync(path.join(TEMPLATES, rel), "utf-8"));

describe("scaffold biome.json", () => {
	const config = readJson("base-project/biome.json");

	it("does not set root: false", () => {
		// The key must be absent, not merely falsy: Biome treats a present
		// `root` key as an explicit declaration either way.
		assert.ok(
			!("root" in config),
			`root must be absent, got ${JSON.stringify(config.root)}`,
		);
	});

	it("enables Tailwind directives so globals.css parses", () => {
		assert.strictEqual(config.css?.parser?.tailwindDirectives, true);
	});

	it("honours .gitignore", () => {
		assert.strictEqual(config.vcs?.enabled, true);
		assert.strictEqual(config.vcs?.useIgnoreFile, true);
	});

	it("excludes the Prisma generated client", () => {
		assert.ok(
			config.files.includes.includes("!packages/db/src/generated"),
			"the generated client must be excluded",
		);
	});

	it("does not exclude the monorepo template directory", () => {
		assert.ok(
			!config.files.includes.some((e) => e.includes("packages/cli/templates")),
			"a scaffold is not the monorepo; it must not inherit the exclusion",
		);
	});
});

describe("apps/web biome.json", () => {
	const config = readJson("base-project/apps/web/biome.json");

	it("stays non-root because it extends the project config", () => {
		assert.strictEqual(config.root, false);
		assert.deepStrictEqual(config.extends, ["../../biome.json"]);
	});
});
