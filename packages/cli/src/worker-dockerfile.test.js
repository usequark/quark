#!/usr/bin/env node

/**
 * Worker Dockerfile guards.
 *
 * `pnpm deploy --prod` drops devDependencies but keeps the peer subtrees pnpm
 * auto-installed *for* them. `prisma` (a devDependency of packages/db) declares
 * `typescript` as an optional peer, so the hoisted store gains typescript@7 -
 * the native Go build, which ships a ~100 MB Go `tsc` carrying 10 HIGH CVEs.
 * The runtime worker image runs compiled JS and does not need it.
 *
 * These assertions run against the monorepo Dockerfile AND the scaffold
 * template, so a regression cannot reappear in newly generated projects.
 *
 * Run with: node --test packages/cli/src/worker-dockerfile.test.js
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

const DOCKERFILES = [
	["monorepo", "apps/worker/Dockerfile"],
	["scaffold template", "packages/cli/templates/worker/Dockerfile"],
];

describe("worker Dockerfile strips dev-only native binaries", () => {
	for (const [label, relativePath] of DOCKERFILES) {
		it(`${label} removes the auto-installed typescript subtree`, () => {
			const dockerfile = fs.readFileSync(
				path.join(REPO_ROOT, relativePath),
				"utf-8",
			);

			assert.match(
				dockerfile,
				/\/app\/deploy\/node_modules\/\.pnpm\/typescript@\*/,
				"must strip the auto-installed typescript subtree from the deploy output",
			);
			assert.match(
				dockerfile,
				/@typescript\+typescript-\*/,
				"must strip the @typescript platform binaries (the Go tsc)",
			);
			assert.match(
				dockerfile,
				/\*_typescript@\*/,
				"must strip peer-suffixed directories such as valibot@1.4.2_typescript@7.0.2",
			);
			assert.match(
				dockerfile,
				/dev-only TypeScript binary leaked/,
				"must fail the build if a dev-only binary reappears",
			);
		});

		it(`${label} keeps the pruning after the deploy step`, () => {
			const dockerfile = fs.readFileSync(
				path.join(REPO_ROOT, relativePath),
				"utf-8",
			);

			const deployIndex = dockerfile.indexOf("prod deploy");
			const pruneIndex = dockerfile.indexOf("node_modules/.pnpm/typescript@*");
			const copyIndex = dockerfile.lastIndexOf(
				"COPY --from=builder /app/deploy/",
			);

			assert.ok(
				deployIndex > -1,
				"Dockerfile must still use `pnpm deploy --prod`",
			);
			assert.ok(pruneIndex > deployIndex, "pruning must run after the deploy");
			assert.ok(
				pruneIndex < copyIndex,
				"pruning must run before the deploy output is copied into the runtime stage",
			);
		});
	}
});
