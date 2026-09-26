#!/usr/bin/env node

/**
 * Scaffold output regression tests.
 *
 * A freshly scaffolded project must not contain any un-substituted
 * __QUARK_* placeholders or @myquark package scopes. This guards the whole
 * class of template-substitution bugs, including files outside the
 * AI-context substitution list (docs, Railway config, embedded skills).
 *
 * Run with: node --test packages/cli/src/scaffold-output.test.js
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const CLI = path.join(import.meta.dirname, "index.js");
const PROJECT_NAME = "placeholder-app";

let tempDir;
let projectDir;

function runCLI(args, cwd) {
	return spawnSync(process.execPath, [CLI, ...args], {
		cwd,
		encoding: "utf8",
		timeout: 120_000,
		env: { ...process.env, QUARK_SKIP_GIT_INIT: "true" },
	});
}

function collectFiles(dir, files = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === ".git") continue;
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			collectFiles(fullPath, files);
		} else {
			files.push(fullPath);
		}
	}
	return files;
}

before(() => {
	tempDir = mkdtempSync(path.join(tmpdir(), "quark-scaffold-output-"));
	const result = runCLI(
		[
			PROJECT_NAME,
			"--no-prompts",
			"--packages",
			"ui",
			"--skip-install",
			"--skip-docker",
		],
		tempDir,
	);
	assert.strictEqual(
		result.status,
		0,
		`scaffold failed\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
	);
	projectDir = path.join(tempDir, PROJECT_NAME);
});

after(() => {
	if (tempDir) {
		rmSync(tempDir, { recursive: true, force: true });
	}
});

describe("scaffold output placeholders", () => {
	it("contains no un-substituted __QUARK_* or @myquark placeholders", () => {
		const offenders = [];

		for (const file of collectFiles(projectDir)) {
			let content;
			try {
				content = fs.readFileSync(file, "utf-8");
			} catch {
				continue;
			}
			if (/__QUARK_|@myquark/.test(content)) {
				offenders.push(path.relative(projectDir, file));
			}
		}

		assert.deepStrictEqual(
			offenders,
			[],
			`placeholder leaks found in: ${offenders.join(", ")}`,
		);
	});

	it("rewrites the DB import in AI prompts to the project scope", () => {
		const page = fs.readFileSync(
			path.join(projectDir, "apps/web/src/app/page.js"),
			"utf-8",
		);
		assert.ok(
			page.includes(`@${PROJECT_NAME}/db`),
			"AI prompt must reference @<scope>/db",
		);
		assert.ok(
			!page.includes("@__QUARK_SCOPE__"),
			"AI prompt must not keep the scope placeholder",
		);
	});

	it("substitutes the project name in docs and Railway config", () => {
		const mainMd = fs.readFileSync(path.join(projectDir, "MAIN.md"), "utf-8");
		assert.ok(
			mainMd.startsWith(`# ${PROJECT_NAME}`),
			"MAIN.md title must use the project name",
		);

		const envExample = fs.readFileSync(
			path.join(projectDir, ".env.railway.example"),
			"utf-8",
		);
		assert.ok(
			envExample.includes(`APP_NAME=${PROJECT_NAME}`),
			".env.railway.example must use the project name",
		);

		const railway = fs.readFileSync(
			path.join(projectDir, ".railway/railway.ts"),
			"utf-8",
		);
		assert.ok(
			railway.includes(`project("${PROJECT_NAME}"`),
			".railway/railway.ts must use the project name",
		);
	});

	it("substitutes placeholders in embedded skills", () => {
		const skill = fs.readFileSync(
			path.join(projectDir, ".opencode/skills/payment/SKILL.md"),
			"utf-8",
		);
		assert.ok(
			skill.includes(`@${PROJECT_NAME}/db`),
			"embedded skills must use the project scope",
		);
	});
});
