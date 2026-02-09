import assert from "node:assert";
import { test } from "node:test";
import { JOB_NAMES, JOB_QUEUES } from "./definitions.js";

test("Job Definitions - defines email queue", () => {
	assert.strictEqual(JOB_QUEUES.EMAIL, "email-queue");
});

test("Job Definitions - defines welcome email job name", () => {
	assert.strictEqual(JOB_NAMES.SEND_WELCOME_EMAIL, "send-welcome-email");
});

test("Job Definitions - queues are readonly", () => {
	assert.strictEqual(typeof JOB_QUEUES.EMAIL, "string");
});
