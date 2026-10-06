/**
 * Tests for the next-auth Nodemailer guard in scripts/check-standards.mjs.
 *
 * pnpm-workspace.yaml removes the `nodemailer` peer edge that next-auth and
 * @auth/core pull in, because their declared range (`^7.0.7 || ^8.0.5`) contains
 * no version that is free of an advisory and both packages are already at their
 * latest release. That override is what clears 13 of the 21 advisories.
 *
 * The cost is that `next-auth/providers/nodemailer` stops resolving. The failure is
 * late and opaque: the provider module does `import { createTransport } from
 * "nodemailer"` at module scope, so it surfaces as ERR_MODULE_NOT_FOUND on the next
 * server start rather than as a build error, with nothing pointing at the override.
 *
 * So the check has to actually fire. These tests run the real script as a
 * subprocess against a throwaway fixture, because the script is top-level and
 * side-effecting with no exports.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

/**
 * The check scans `apps`, `packages` and `scripts` relative to process.cwd(), so the
 * fixture needs one of those directories plus a source file inside it to judge. The
 * real script is invoked from the repo against this cwd, so it resolves its own
 * patterns and templates correctly while judging only the fixture's files.
 */
function scaffold(files) {
	const dir = mkdtempSync(path.join(tmpdir(), "quark-nodemailer-guard-"));
	for (const [relativePath, contents] of Object.entries(files)) {
		const absolute = path.join(dir, relativePath);
		mkdirSync(path.dirname(absolute), { recursive: true });
		writeFileSync(absolute, contents);
	}
	return dir;
}

function runStandards(cwd) {
	return spawnSync(
		process.execPath,
		[path.join(repoRoot, "scripts/check-standards.mjs")],
		{
			cwd,
			encoding: "utf8",
		},
	);
}

const temporaryDirs = [];

/**
 * Track the fixture for cleanup and return it.
 */
function scaffoldTracked(files) {
	const dir = scaffold(files);
	temporaryDirs.push(dir);
	return dir;
}

after(() => {
	for (const dir of temporaryDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("next-auth Nodemailer guard", () => {
	it("passes when no file imports the Nodemailer provider", () => {
		const dir = scaffoldTracked({
			"apps/web/src/lib/auth.js":
				'import CredentialsProvider from "next-auth/providers/credentials";\nexport default CredentialsProvider;\n',
		});

		const result = runStandards(dir);

		assert.equal(
			result.status,
			0,
			`expected a clean pass, got:\n${result.stdout}${result.stderr}`,
		);
		assert.match(result.stdout, /Standards check passed/);
	});

	it("fails when a source file imports next-auth/providers/nodemailer", () => {
		const dir = scaffoldTracked({
			"apps/web/src/lib/auth.js":
				'import Nodemailer from "next-auth/providers/nodemailer";\nexport default Nodemailer;\n',
		});

		const result = runStandards(dir);

		assert.equal(result.status, 1, "the guard must fail the build");
		assert.match(
			result.stderr,
			/next-auth\/providers\/nodemailer cannot resolve/,
		);
	});

	it("names the override and the patched version in the failure message", () => {
		const dir = scaffoldTracked({
			"apps/web/src/lib/auth.js":
				'import Nodemailer from "next-auth/providers/nodemailer";\nexport default Nodemailer;\n',
		});

		const result = runStandards(dir);

		// A bare "cannot resolve" leaves the reader no idea an override caused it,
		// which is the whole failure mode this guard exists to prevent.
		assert.match(result.stderr, /pnpm-workspace\.yaml/);
		assert.match(result.stderr, /10\.0\.6/);
	});

	it("reports the offending file and line", () => {
		const dir = scaffoldTracked({
			"apps/web/src/lib/auth.js":
				'// line one\nimport Nodemailer from "next-auth/providers/nodemailer";\n',
		});

		const result = runStandards(dir);

		assert.match(result.stderr, /apps\/web\/src\/lib\/auth\.js:2/);
	});

	it("catches the CommonJS require form too", () => {
		const dir = scaffoldTracked({
			"apps/web/src/lib/email.js":
				'const Nodemailer = require("next-auth/providers/nodemailer");\nmodule.exports = Nodemailer;\n',
		});

		const result = runStandards(dir);

		assert.equal(result.status, 1);
		assert.match(
			result.stderr,
			/next-auth\/providers\/nodemailer cannot resolve/,
		);
	});

	it("covers the scaffold template as well as the monorepo", () => {
		const dir = scaffoldTracked({
			"packages/cli/templates/base-project/apps/web/src/lib/auth.js":
				'import Nodemailer from "next-auth/providers/nodemailer";\nexport default Nodemailer;\n',
		});

		const result = runStandards(dir);

		assert.equal(result.status, 1);
		assert.match(
			result.stderr,
			/next-auth\/providers\/nodemailer cannot resolve/,
		);
	});

	it("does not flag the other next-auth providers", () => {
		const dir = scaffoldTracked({
			"apps/web/src/lib/auth.js": [
				'import CredentialsProvider from "next-auth/providers/credentials";',
				'import GithubProvider from "next-auth/providers/github";',
				'import GoogleProvider from "next-auth/providers/google";',
				"export default [CredentialsProvider, GithubProvider, GoogleProvider];",
				"",
			].join("\n"),
		});

		const result = runStandards(dir);

		assert.equal(
			result.status,
			0,
			`providers other than nodemailer must stay allowed, got:\n${result.stdout}${result.stderr}`,
		);
	});

	it("does not flag a mention of nodemailer in a comment or unrelated import", () => {
		const dir = scaffoldTracked({
			"apps/web/src/lib/mail.js": [
				"// Sending mail uses @usequark/quark-core, not next-auth/providers/nodemailer.",
				'import nodemailer from "nodemailer";',
				"export default nodemailer;",
				"",
			].join("\n"),
		});

		const result = runStandards(dir);

		assert.equal(
			result.status,
			0,
			`a comment mentioning the path must not fail the build, got:\n${result.stdout}${result.stderr}`,
		);
	});
});
