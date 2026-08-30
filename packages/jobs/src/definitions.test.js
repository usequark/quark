import assert from "node:assert";
import { describe, test } from "node:test";
import { JOB_NAMES, JOB_QUEUES } from "./definitions.js";

// ── JOB_QUEUES ───────────────────────────────────────────────────────────────

describe("JOB_QUEUES", () => {
	test("defines email queue", () => {
		assert.strictEqual(JOB_QUEUES.EMAIL, "email-queue");
	});

	test("defines files queue", () => {
		assert.strictEqual(JOB_QUEUES.FILES, "files-queue");
	});

	test("defines default queue", () => {
		assert.strictEqual(JOB_QUEUES.DEFAULT, "default-queue");
	});

	test("defines push queue", () => {
		assert.strictEqual(JOB_QUEUES.PUSH, "push-queue");
	});

	test("queues are strings", () => {
		assert.strictEqual(typeof JOB_QUEUES.EMAIL, "string");
		assert.strictEqual(typeof JOB_QUEUES.FILES, "string");
		assert.strictEqual(typeof JOB_QUEUES.DEFAULT, "string");
		assert.strictEqual(typeof JOB_QUEUES.PUSH, "string");
	});

	test("defines exactly 4 queues", () => {
		assert.strictEqual(Object.keys(JOB_QUEUES).length, 4);
	});
});

// ── JOB_NAMES ────────────────────────────────────────────────────────────────

describe("JOB_NAMES", () => {
	test("defines welcome email job name", () => {
		assert.strictEqual(JOB_NAMES.SEND_WELCOME_EMAIL, "send-welcome-email");
	});

	test("defines reset password email job name", () => {
		assert.strictEqual(
			JOB_NAMES.SEND_RESET_PASSWORD_EMAIL,
			"send-reset-password-email",
		);
	});

	test("defines cleanup orphaned files job name", () => {
		assert.strictEqual(
			JOB_NAMES.CLEANUP_ORPHANED_FILES,
			"cleanup-orphaned-files",
		);
	});

	test("defines send push notification job name", () => {
		assert.strictEqual(
			JOB_NAMES.SEND_PUSH_NOTIFICATION,
			"send-push-notification",
		);
	});

	test("defines exactly 4 job names", () => {
		assert.strictEqual(Object.keys(JOB_NAMES).length, 4);
	});

	test("all job names are strings", () => {
		for (const [key, value] of Object.entries(JOB_NAMES)) {
			assert.strictEqual(typeof value, "string", `${key} should be a string`);
		}
	});

	test("job names are kebab-case", () => {
		for (const [key, value] of Object.entries(JOB_NAMES)) {
			assert.ok(
				/^[a-z]+(-[a-z]+)*$/.test(value),
				`${key}="${value}" should be kebab-case`,
			);
		}
	});
});
