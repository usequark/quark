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

import { SCAFFOLD_GITIGNORE_ENTRIES } from "./scaffold-gitignore.js";

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

	// Guards the scope rewrite itself. replaceDepsScope and
	// replaceImportsInSourceFiles map the framework scope onto the project's own
	// scope for db/jobs/ui/config, and leave the published quark-core registry
	// dependency alone on purpose.
	//
	// db, jobs, ui and config are local-only workspace packages and have never
	// been published to any registry, so a framework-scoped reference surviving
	// into generated output produces a project that cannot install. Nothing else
	// catches that: the placeholder test above only looks for __QUARK_ and
	// @myquark, so a rewrite rule that silently stopped matching - because a
	// template and its rule drifted apart - left every test in this repo green
	// while every scaffolded app was broken.
	//
	// Both scopes are asserted. @techstream is the pre-rename scope and must not
	// appear at all; @usequark is the current one and must not appear for the
	// local-only packages, though @usequark/quark-core is expected and correct.
	//
	// Scoped to files that participate in module resolution. Markdown and .mdc
	// instruction files legitimately name the framework scope in order to tell an
	// agent never to import it - .cursor/rules/quark.mdc ships exactly that
	// prohibition, alongside deliberately-wrong import examples. Prose cannot
	// break an install; an import or a dependency can.
	it("never leaks a framework-scoped reference to a local-only package", () => {
		const RESOLVABLE = /\.(js|jsx|mjs|cjs|ts|tsx)$/;
		const localOnly = /@(techstream|usequark)\/quark-(db|jobs|ui|config)\b/;
		const offenders = [];

		for (const file of collectFiles(projectDir)) {
			const rel = path.relative(projectDir, file);
			const base = path.basename(file);
			if (base !== "package.json" && !RESOLVABLE.test(base)) continue;

			let content;
			try {
				content = fs.readFileSync(file, "utf-8");
			} catch {
				continue;
			}
			if (localOnly.test(content)) {
				offenders.push(rel);
			}
		}

		assert.deepStrictEqual(
			offenders,
			[],
			`local-only packages must be rewritten to the project scope; leaked in: ${offenders.join(", ")}`,
		);
	});

	// npm strips every .gitignore from published tarballs, so the template copy
	// never reaches a CLI installed from npm. The scaffolder writes one from
	// src/scaffold-gitignore.js instead - this asserts it actually arrives, and
	// that it covers the paths that would otherwise be committed.
	it("ships a .gitignore covering dependencies, build output and secrets", () => {
		const gitignorePath = path.join(projectDir, ".gitignore");
		assert.ok(
			fs.existsSync(gitignorePath),
			"scaffolded project has no .gitignore - npm strips it from tarballs, so the CLI must write it",
		);

		const content = fs.readFileSync(gitignorePath, "utf-8");
		for (const entry of SCAFFOLD_GITIGNORE_ENTRIES) {
			if (entry === "" || entry.startsWith("#")) continue;
			assert.ok(
				content.split("\n").includes(entry),
				`.gitignore is missing "${entry}"`,
			);
		}

		// The whole point: the scaffolder runs `git init`, so an unignored .env
		// means the first `git add .` stages real credentials.
		for (const critical of ["node_modules/", ".env", ".next/"]) {
			assert.ok(
				content.split("\n").includes(critical),
				`.gitignore must ignore ${critical} or a generated project commits secrets`,
			);
		}
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

	// Regression guards for the two doc bugs found reviewing the port/placeholder
	// work. Both were pure documentation lies: the port logic was already correct,
	// so nothing failed and nothing warned - the docs simply sent the user to the
	// wrong URL or a file that is never scaffolded.
	it("never hardcodes the web port in doc templates", () => {
		// Checked on the template, not the scaffolded output. In the output,
		// localhost:3000 is the *correct* link whenever 3000 happens to be free, so
		// asserting on rendered output would be both environment-dependent and
		// self-contradictory. The invariant that actually matters is that the port
		// can only ever reach these docs through the placeholder.
		const templateDir = path.join(
			import.meta.dirname,
			"../templates/base-project",
		);

		for (const relPath of ["MAIN.md", "README.md"]) {
			const content = fs.readFileSync(path.join(templateDir, relPath), "utf-8");
			assert.ok(
				!content.includes("localhost:3000"),
				`${relPath} hardcodes localhost:3000 - the CLI resolves a free port via findAvailablePort, so use __QUARK_WEB_PORT__`,
			);
			assert.ok(
				content.includes("__QUARK_WEB_PORT__"),
				`${relPath} must link to the generated web port via __QUARK_WEB_PORT__`,
			);
		}
	});

	it("points scaffolded docs at the web port it actually generated in .env", () => {
		const env = fs.readFileSync(path.join(projectDir, ".env"), "utf-8");
		const portLine = env.split("\n").find((line) => line.startsWith("PORT="));
		assert.ok(portLine, ".env must define PORT");
		const port = portLine.slice("PORT=".length).trim();
		assert.match(port, /^\d+$/, `PORT must be numeric, got ${port}`);

		for (const relPath of ["MAIN.md", "README.md"]) {
			const content = fs.readFileSync(path.join(projectDir, relPath), "utf-8");
			assert.ok(
				content.includes(`http://localhost:${port}`),
				`${relPath} must link to the port the CLI generated (${port}), proving __QUARK_WEB_PORT__ was substituted`,
			);
		}
	});

	// The README branding block ships the Quark mark as a stand-in logo from
	// apps/web/public/quark.svg. An earlier template referenced a logo path the
	// scaffold never creates, so the hero of every generated README was a broken
	// image. This asserts every local src resolves - a badge that 404s is worse
	// than no badge.
	it("resolves every local image in the README to a file the scaffold creates", () => {
		const readme = fs.readFileSync(path.join(projectDir, "README.md"), "utf-8");

		const localSrcs = [...readme.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)]
			.map((match) => match[1])
			.filter((src) => !/^https?:\/\//.test(src));

		assert.ok(
			localSrcs.length > 0,
			"README must reference at least one local image - the branding block is the point of the template",
		);

		for (const src of localSrcs) {
			assert.ok(
				fs.existsSync(path.join(projectDir, src)),
				`README references ${src} but the scaffold never creates it`,
			);
		}
	});

	it("seeds the README tagline from the project brief the CLI captured", () => {
		const readme = fs.readFileSync(path.join(projectDir, "README.md"), "utf-8");
		assert.match(
			readme,
			/<strong>Placeholder App application<\/strong>/,
			"README tagline must be the substituted __QUARK_PROJECT_BRIEF__ value, not a leftover placeholder",
		);
		assert.ok(
			!/__QUARK_/.test(readme),
			"README must not keep any __QUARK_* placeholder after substitution",
		);
	});

	it("does not point MAIN.md at files the scaffold never creates", () => {
		const mainMd = fs.readFileSync(path.join(projectDir, "MAIN.md"), "utf-8");
		const readFirst = mainMd.split("## Read this first")[1]?.split("##")[0];
		assert.ok(readFirst, "MAIN.md must keep a 'Read this first' section");

		const dangling = [];
		for (const match of readFirst.matchAll(/`([^`]+)`/g)) {
			const ref = match[1];
			// Strip a trailing slash and any description the sentence appended.
			const target = ref.replace(/\/$/, "").split(/\s+/)[0];
			if (!fs.existsSync(path.join(projectDir, target))) {
				dangling.push(ref);
			}
		}

		assert.deepEqual(
			dangling,
			[],
			`MAIN.md "Read this first" references ${dangling.length} path(s) the scaffold does not create - an agent follows these first and finds nothing`,
		);
	});
});
