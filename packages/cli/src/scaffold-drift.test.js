#!/usr/bin/env node

/**
 * `update --scaffold-check` regression tests.
 *
 * The drift check rebuilds a reference scaffold in a temp dir and diffs it
 * against the project. Two defects made it unusable:
 *
 *   1. `mobile` is recorded in .quark-link.json by `add mobile` but rejected at
 *      create time, and it was forwarded to the reference-scaffold subprocess
 *      anyway — the subprocess exited non-zero, the error was rethrown, and
 *      `update --scaffold-check` crashed on every project that had ever run
 *      `add mobile`.
 *   2. The reference was built without the project's `--prompt`/`--harness`, so
 *      every project with a custom brief reported false drift on the
 *      brief-seeded doc files, and every `--harness claude|copilot` project
 *      reported false-missing skill files for the default .opencode/skills
 *      directory it never had.
 *
 * A drift detector that fails both ways is worse than none — it trains
 * maintainers to ignore it.
 *
 * Run with: node --test packages/cli/src/scaffold-drift.test.js
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const CLI = path.join(import.meta.dirname, "index.js");
const PROJECT_NAME = "drift-app";

let tempDir;
let projectDir;

function runCreate(args, cwd) {
	// Create is the default command: the project name is the first argument,
	// there is no `create` subcommand.
	return spawnSync(process.execPath, [CLI, ...args], {
		cwd,
		encoding: "utf8",
		timeout: 180_000,
		env: { ...process.env, QUARK_SKIP_GIT_INIT: "true" },
	});
}

function runUpdate(cwd) {
	return spawnSync(
		process.execPath,
		[CLI, "update", "--scaffold-check", "--fail-on-drift"],
		{
			cwd,
			encoding: "utf8",
			timeout: 180_000,
			env: { ...process.env, QUARK_SKIP_GIT_INIT: "true" },
		},
	);
}

function scaffold(name, extraArgs = []) {
	const result = runCreate(
		[name, "--no-prompts", "--skip-install", "--skip-docker", ...extraArgs],
		tempDir,
	);
	assert.strictEqual(
		result.status,
		0,
		`scaffold failed\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
	);
	return path.join(tempDir, name);
}

before(() => {
	tempDir = mkdtempSync(path.join(tmpdir(), "quark-scaffold-drift-"));
	projectDir = scaffold(PROJECT_NAME);
});

after(() => {
	if (tempDir) {
		rmSync(tempDir, { recursive: true, force: true });
	}
});

describe("update --scaffold-check", () => {
	it("reports no drift on a freshly scaffolded project", () => {
		const result = runUpdate(projectDir);

		assert.strictEqual(
			result.status,
			0,
			`expected a clean drift check\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
		);
		assert.match(result.stdout, /No scaffold drift detected/);
	});

	// The reference scaffold must be built with the project's brief and harness.
	// Before the fix the reference used the default brief ("<name> application")
	// and the default harness directory, so a custom-brief claude project showed
	// permanent false drift: MAIN.md and the AI-context docs reported changed,
	// and the default .opencode/skills files reported missing.
	it("forwards the project's brief and harness so custom projects show no false drift", () => {
		const customDir = scaffold("custom-app", [
			"--prompt",
			"An invoice tool for plumbers",
			"--harness",
			"claude",
		]);

		const result = runUpdate(customDir);

		assert.strictEqual(
			result.status,
			0,
			`expected no false drift for a custom brief + claude harness\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
		);
		assert.match(result.stdout, /No scaffold drift detected/);
		// The reference must have been built with claude's skill directory —
		// if the harness were not forwarded, .opencode/skills would be missing.
		assert.ok(
			!result.stdout.includes(".opencode/skills"),
			"drift report references the default opencode harness on a claude project",
		);
	});

	// `add mobile` records mobile in .quark-link.json. Before the fix that value
	// was forwarded to the create subprocess, which rejects mobile at creation
	// time, and the rejection crashed the whole command:
	//   Error: Could not generate the reference scaffold.
	//   ✗ Error creating project: Mobile app cannot be included during project
	//     creation.
	it("does not crash when .quark-link.json records mobile", () => {
		const linkPath = path.join(projectDir, ".quark-link.json");
		const link = JSON.parse(readFileSync(linkPath, "utf8"));
		const withMobile = {
			...link,
			packages: [...link.packages, "mobile"],
		};
		writeFileSync(linkPath, JSON.stringify(withMobile, null, "\t"));

		try {
			const result = runUpdate(projectDir);

			assert.strictEqual(
				result.status,
				0,
				`drift check must not crash on an add-mobile project\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
			);
			assert.ok(
				!/Could not generate the reference scaffold/.test(
					`${result.stdout}${result.stderr}`,
				),
				"drift check failed to build its reference scaffold",
			);
		} finally {
			writeFileSync(linkPath, JSON.stringify(link, null, "\t"));
		}
	});

	// A check that cannot build its reference scaffold must fail cleanly with a
	// non-zero exit — not an unhandled stack trace that reads like a CLI crash.
	// An invalid recorded project name makes the create subprocess throw, which
	// is the same failure shape as the mobile rejection was.
	it("fails cleanly instead of throwing when the reference scaffold cannot be built", () => {
		const linkPath = path.join(projectDir, ".quark-link.json");
		const link = JSON.parse(readFileSync(linkPath, "utf8"));
		writeFileSync(
			linkPath,
			JSON.stringify({ ...link, projectName: "Invalid Name!" }, null, "\t"),
		);

		try {
			const result = runUpdate(projectDir);

			assert.strictEqual(result.status, 1);
			assert.match(
				`${result.stdout}${result.stderr}`,
				/Scaffold check could not run/,
			);
			assert.ok(
				!/^\s*at\s/.test(result.stderr),
				"failure surfaced as an unhandled stack trace",
			);
		} finally {
			writeFileSync(linkPath, JSON.stringify(link, null, "\t"));
		}
	});
});

// The web-side enqueue helpers duplicate the queue and job names from the jobs
// package on purpose: `@<scope>/jobs` is an optional scaffold package, and
// importing it from the web module broke the build of every project that
// declined jobs. The duplication is only safe if it cannot drift — this is the
// guard that fails when the two copies diverge. Asserted against the templates
// because those are the shipped artifacts the scaffolder copies.
describe("email queue/job name contract", () => {
	it("keeps the web-side names in sync with the jobs package definitions", () => {
		const definitions = readFileSync(
			path.join(import.meta.dirname, "../templates/jobs/src/definitions.js"),
			"utf8",
		);

		const queueName = definitions.match(/EMAIL:\s*"([^"]+)"/)?.[1];
		assert.ok(queueName, "jobs definitions must define the EMAIL queue name");

		const contract = [
			{
				jobKey: "SEND_WELCOME_EMAIL",
				helper: "enqueue-welcome-email.js",
			},
			{
				jobKey: "SEND_VERIFY_EMAIL",
				helper: "enqueue-verification-email.js",
			},
			{
				jobKey: "SEND_RESET_PASSWORD_EMAIL",
				helper: "enqueue-reset-password-email.js",
			},
		];

		// The queue name now lives in the shared helper; every enqueue wrapper
		// re-exports it from there, so one check covers them all.
		const sharedEnqueue = readFileSync(
			path.join(
				import.meta.dirname,
				"../templates/base-project/apps/web/src/lib/enqueue-email-job.js",
			),
			"utf8",
		);
		assert.match(
			sharedEnqueue,
			new RegExp(`EMAIL_QUEUE = "${queueName}"`),
			`web-side EMAIL_QUEUE must be "${queueName}" to match the jobs package`,
		);

		for (const { jobKey, helper } of contract) {
			const jobName = definitions.match(
				new RegExp(`${jobKey}:\\s*"([^"]+)"`),
			)?.[1];
			assert.ok(jobName, `jobs definitions must define the ${jobKey} job name`);

			const helperSource = readFileSync(
				path.join(
					import.meta.dirname,
					`../templates/base-project/apps/web/src/lib/${helper}`,
				),
				"utf8",
			);
			assert.match(
				helperSource,
				new RegExp(`${jobKey} = "${jobName}"`),
				`web-side ${jobKey} must be "${jobName}" to match the jobs package`,
			);
		}
	});
});
