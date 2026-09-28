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

	it("generates a migration.sql that Postgres can execute", () => {
		const migrationSql = fs.readFileSync(
			path.join(
				projectDir,
				"packages/db/prisma/migrations/20260202061128_initial/migration.sql",
			),
			"utf-8",
		);

		// Regression: capturing `prisma migrate diff --script` with a plain `>`
		// also writes Prisma's stdout log line into the SQL. Postgres rejects the
		// whole migration with `42601 syntax error at or near "Loaded"`, so every
		// scaffolded project failed its first `db:migrate:deploy`.
		const lines = migrationSql
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		assert.ok(
			!lines.some((line) => /^Loaded Prisma config/.test(line)),
			"migration.sql must not contain Prisma's stdout log line",
		);

		const firstStatement = lines.find((line) => !line.startsWith("--"));
		assert.ok(
			/^(CREATE|ALTER|DROP|INSERT|UPDATE)\b/.test(firstStatement),
			`migration.sql must begin with a SQL statement (got: ${firstStatement})`,
		);
	});

	it("scaffolds the PWA manifest as manifest.js, not a conflicting manifest.json", () => {
		const appDir = path.join(projectDir, "apps/web/src/app");

		// Next.js serves app/manifest.js at /manifest.webmanifest. A sibling
		// app/manifest.json (what the PWA feature used to write) makes the build
		// fail with "Cannot find module for page: /manifest.webmanifest".
		assert.ok(
			!fs.existsSync(path.join(appDir, "manifest.json")),
			"app/manifest.json must not be scaffolded alongside app/manifest.js",
		);

		const manifest = fs.readFileSync(path.join(appDir, "manifest.js"), "utf-8");
		assert.ok(
			!manifest.includes("@__QUARK_SCOPE__"),
			"PWA manifest must use the project scope, not __QUARK_SCOPE__",
		);
		assert.ok(
			manifest.includes(`@${PROJECT_NAME}/config`),
			"PWA manifest must import config from the project scope",
		);
	});

	it("generates a valid auth section in .env.example", () => {
		const envExample = fs.readFileSync(
			path.join(projectDir, ".env.example"),
			"utf-8",
		);

		const secretLine = envExample
			.split("\n")
			.find((line) => line.startsWith("NEXTAUTH_SECRET="));
		assert.ok(secretLine, ".env.example must define NEXTAUTH_SECRET");
		const secret = secretLine.slice("NEXTAUTH_SECRET=".length);
		assert.ok(
			secret.length >= 32,
			`NEXTAUTH_SECRET placeholder must be at least 32 characters (got ${secret.length}) - startup validation rejects shorter values`,
		);

		assert.ok(
			!/NEXTAUTH_URL=.*\/api\/auth/.test(envExample),
			"NEXTAUTH_URL must be a bare origin, never include a path",
		);
		assert.ok(
			!envExample.includes("derived automatically from PORT"),
			"APP_URL is not derived from PORT - do not claim it is",
		);
	});
});
