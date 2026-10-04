#!/usr/bin/env node

/**
 * Behavior tests for scripts shipped in the scaffolded base project.
 *
 * These run the template copies directly against synthetic project layouts,
 * so they catch drift between the template scripts and what scaffolded
 * projects actually need.
 *
 * Run with: node --test packages/cli/src/template-scripts.test.js
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const TEMPLATE_DIR = path.join(
	import.meta.dirname,
	"../templates/base-project",
);
const tempDirs = [];

function makeTempDir() {
	const dir = mkdtempSync(path.join(tmpdir(), "quark-template-scripts-"));
	tempDirs.push(dir);
	return dir;
}

function writeFile(root, relPath, content) {
	const fullPath = path.join(root, relPath);
	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content);
}

function copyScript(root, relPath) {
	const dest = path.join(root, relPath);
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.copyFileSync(path.join(TEMPLATE_DIR, relPath), dest);
	return dest;
}

function runScript(root, relPath) {
	return spawnSync(process.execPath, [path.join(root, relPath)], {
		cwd: root,
		encoding: "utf8",
		timeout: 30_000,
	});
}

after(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("check-loading.mjs", () => {
	it("flags a DB-backed page without a sibling loading.js", () => {
		const dir = makeTempDir();
		copyScript(dir, "scripts/check-loading.mjs");
		writeFile(
			dir,
			"apps/web/src/app/orders/page.js",
			'import { prisma } from "@demo/db";\n\nexport default function Page() {\n\treturn null;\n}\n',
		);

		const result = runScript(dir, "scripts/check-loading.mjs");

		assert.strictEqual(
			result.status,
			1,
			"audit must exit 1 when loading.js is missing",
		);
		assert.match(result.stderr, /MISSING loading\.js/);
	});

	it("passes when the DB-backed page has a sibling loading.js", () => {
		const dir = makeTempDir();
		copyScript(dir, "scripts/check-loading.mjs");
		writeFile(
			dir,
			"apps/web/src/app/orders/page.js",
			'import { prisma } from "@demo/db";\n\nexport default function Page() {\n\treturn null;\n}\n',
		);
		writeFile(
			dir,
			"apps/web/src/app/orders/loading.js",
			"export default null;\n",
		);

		const result = runScript(dir, "scripts/check-loading.mjs");

		assert.strictEqual(result.status, 0, result.stderr);
	});

	it("ignores pages that do not import a db package", () => {
		const dir = makeTempDir();
		copyScript(dir, "scripts/check-loading.mjs");
		writeFile(
			dir,
			"apps/web/src/app/about/page.js",
			'import { Button } from "@demo/ui";\n\nexport default function Page() {\n\treturn null;\n}\n',
		);

		const result = runScript(dir, "scripts/check-loading.mjs");

		assert.strictEqual(result.status, 0, result.stderr);
	});

	it("also recognizes the monorepo db package name", () => {
		const dir = makeTempDir();
		copyScript(dir, "scripts/check-loading.mjs");
		writeFile(
			dir,
			"apps/web/src/app/metrics/page.js",
			'import { prisma } from "@usequark/quark-db";\n\nexport default function Page() {\n\treturn null;\n}\n',
		);

		const result = runScript(dir, "scripts/check-loading.mjs");

		assert.strictEqual(
			result.status,
			1,
			"audit must exit 1 when loading.js is missing",
		);
	});
});

describe("check-standards.mjs", () => {
	it("allows TypeScript in apps/mobile after quark add mobile", () => {
		const dir = makeTempDir();
		copyScript(dir, "scripts/check-standards.mjs");
		writeFile(
			dir,
			"apps/mobile/app/(app)/index.tsx",
			"export default function Home() {\n\treturn null;\n}\n",
		);

		const result = runScript(dir, "scripts/check-standards.mjs");

		assert.strictEqual(result.status, 0, result.stderr);
	});

	it("still flags console.* in web app runtime code", () => {
		const dir = makeTempDir();
		copyScript(dir, "scripts/check-standards.mjs");
		writeFile(
			dir,
			"apps/web/src/app/orders/page.js",
			'export default function Page() {\n\tconsole.log("orders");\n\treturn null;\n}\n',
		);

		const result = runScript(dir, "scripts/check-standards.mjs");

		assert.strictEqual(result.status, 1, "console.* must be flagged");
		assert.match(result.stderr, /createLogger\(\)/);
	});
});
