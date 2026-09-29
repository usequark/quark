#!/usr/bin/env node

/**
 * Guard the scaffold template's dependabot config.
 *
 * The template used to group by `dependency-type` alone, which produced one
 * PR bundling patch, minor and major bumps together. That is how several
 * breaking changes reached this repo unnoticed - bullmq 6 removed
 * `queue.client` and shipped two silent production regressions inside a
 * 35-package diff.
 *
 * This checks the shipped template still separates majors, so a scaffolded
 * project does not inherit the problem.
 *
 * Run with: node --test packages/cli/src/dependabot-config.test.js
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

const CONFIGS = [
	["monorepo", ".github/dependabot.yml"],
	[
		"scaffold template",
		"packages/cli/templates/base-project/.github/dependabot.yml",
	],
];

function readConfig(relativePath) {
	return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("dependabot config", () => {
	for (const [label, relativePath] of CONFIGS) {
		it(`${label} isolates major bumps into their own group`, () => {
			const text = readConfig(relativePath);

			assert.match(
				text,
				/production-majors:[\s\S]*?dependency-type:\s*production[\s\S]*?update-types:\s*\["major"\]/,
				"production majors must be grouped separately so a breaking change is reviewed alone",
			);
			assert.match(
				text,
				/development-majors:[\s\S]*?dependency-type:\s*development[\s\S]*?update-types:\s*\["major"\]/,
				"development majors must be grouped separately too",
			);
		});

		it(`${label} does not lump every production bump into one group`, () => {
			const text = readConfig(relativePath);

			// A bare `production:` group with no update-types collects majors,
			// minors and patches into a single reviewable-looking PR.
			assert.doesNotMatch(
				text,
				/\n {6}production:\n {8}dependency-type:\s*production\n/,
				"a catch-all production group re-creates the 35-package PR problem",
			);
		});

		it(`${label} keeps a PR limit that can hold the extra groups`, () => {
			const text = readConfig(relativePath);
			const limit = Number(
				(text.match(/open-pull-requests-limit:\s*(\d+)/) || [])[1],
			);

			assert.ok(
				Number.isInteger(limit) && limit >= 6,
				`open-pull-requests-limit should be at least 6 for the split groups (got ${limit})`,
			);
		});
	}
});

/**
 * The auto-merge workflow is the other half of the split, and the only part
 * that actually merges anything.
 *
 * Splitting dependabot into per-severity groups changes what a human sees. It
 * does not change what merges unattended - that is gated solely by
 * `update-type == 'version-update:semver-patch'`. A dependency that ships a
 * breaking change in a *patch* passes straight through, and that is exactly how
 * bullmq 6's `queue.client` removal reached this repo. Majors already need a
 * human by virtue of not matching; this test keeps it that way.
 *
 * The monorepo runs this workflow; the template ships an equivalent one, so a
 * scaffolded project inherits the same gate.
 */
const AUTO_MERGE_WORKFLOWS = [
	["monorepo", ".github/workflows/dependabot-auto-merge.yml"],
	[
		"scaffold template",
		"packages/cli/templates/base-project/.github/workflows/dependabot-auto-merge.yml",
	],
];

describe("dependabot auto-merge gate", () => {
	for (const [label, relativePath] of AUTO_MERGE_WORKFLOWS) {
		it(`${label} gates auto-merge on the semver update type`, () => {
			const text = readConfig(relativePath);

			assert.match(
				text,
				/version-update:semver-patch/,
				"the auto-merge gate must key on the semver patch update type, so minors and majors still need a human",
			);
		});

		it(`${label} does not merge every dependabot update`, () => {
			const text = readConfig(relativePath);

			// An unconditional `gh pr merge` would auto-merge majors unattended,
			// which is precisely how the bullmq break nearly landed.
			assert.doesNotMatch(
				text,
				/if:\s*github\.actor\s*==\s*'dependabot\[bot\]'\n\s*steps:/,
				"auto-merge must be gated on the update type, not just the actor",
			);
		});
	}
});
