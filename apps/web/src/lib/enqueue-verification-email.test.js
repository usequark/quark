import assert from "node:assert";
import { beforeEach, describe, test } from "node:test";
import { EMAIL_QUEUE } from "./enqueue-email-job.js";
import {
	enqueueVerificationEmail,
	SEND_VERIFY_EMAIL,
} from "./enqueue-verification-email.js";

/**
 * The queue factory the helper was handed, and the queue it built.
 *
 * `loadQueue` is a parameter rather than a hard-coded dynamic import so this
 * file can drive the helper without a Redis server.
 */
let created;
let addCalls;
let closeCalls;
let addImpl;

function stubQueueModule() {
	return {
		createQueue: (name, options) => {
			created.push({ name, options });
			return {
				add: async (job, data, jobOptions) => {
					addCalls.push({ job, data, jobOptions });
					return addImpl(job, data, jobOptions);
				},
				close: async () => {
					closeCalls.push(true);
				},
			};
		},
	};
}

beforeEach(() => {
	created = [];
	addCalls = [];
	closeCalls = [];
	addImpl = async () => ({ id: "job-1" });
});

describe("enqueueVerificationEmail", () => {
	test("queue and job names mirror the jobs package contract", () => {
		assert.strictEqual(EMAIL_QUEUE, "email-queue");
		assert.strictEqual(SEND_VERIFY_EMAIL, "send-verify-email");
	});

	test("adds the verification job for the given user and link", async () => {
		await enqueueVerificationEmail(
			"user-42",
			"https://app.test/api/auth/verify-email?token=abc",
			stubQueueModule,
		);

		assert.strictEqual(created.length, 1);
		assert.strictEqual(created[0].name, EMAIL_QUEUE);
		assert.deepStrictEqual(addCalls, [
			{
				job: SEND_VERIFY_EMAIL,
				data: {
					userId: "user-42",
					verifyUrl: "https://app.test/api/auth/verify-email?token=abc",
				},
				jobOptions: undefined,
			},
		]);
	});

	test("closes the queue so no connection is held by the web process", async () => {
		await enqueueVerificationEmail(
			"user-42",
			"https://app.test/verify",
			stubQueueModule,
		);

		assert.deepStrictEqual(closeCalls, [true]);
	});

	test("closes the queue even when the add fails", async () => {
		addImpl = async () => {
			throw new Error("connect ECONNREFUSED redis://cache:6379");
		};

		await assert.rejects(
			enqueueVerificationEmail(
				"user-42",
				"https://app.test/verify",
				stubQueueModule,
			),
			/ECONNREFUSED/,
		);
		assert.deepStrictEqual(closeCalls, [true]);
	});

	test("surfaces the add failure rather than swallowing it", async () => {
		addImpl = async () => {
			throw new Error("queue is closed");
		};

		// The route decides a verification email is non-critical. The helper must
		// not decide it on the route's behalf, or a caller that cares would never
		// hear about it.
		await assert.rejects(
			enqueueVerificationEmail(
				"user-42",
				"https://app.test/verify",
				stubQueueModule,
			),
			{ message: "queue is closed" },
		);
	});
});
