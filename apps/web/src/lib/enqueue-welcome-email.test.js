import assert from "node:assert";
import { beforeEach, describe, test } from "node:test";
import { JOB_NAMES, JOB_QUEUES } from "@usequark/quark-jobs";
import { enqueueWelcomeEmail } from "./enqueue-welcome-email.js";

/**
 * The queue factory the helper was handed, and the queue it built.
 *
 * `loadQueue` is a parameter rather than a hard-coded dynamic import so this
 * file can drive the helper without a Redis server. The route cannot use that
 * parameter — it calls the helper with one argument — which is exactly why the
 * route's own test mocks the helper instead.
 */
let created;
let addCalls;
let closeCalls;

/** What `queue.add` does on this call. */
let addImpl;

/** A stand-in for the queue module, shaped like the real one. */
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

describe("enqueueWelcomeEmail", () => {
	test("adds the welcome-email job for the given user", async () => {
		await enqueueWelcomeEmail("user-42", stubQueueModule);

		assert.strictEqual(created.length, 1);
		assert.strictEqual(created[0].name, JOB_QUEUES.EMAIL);
		assert.deepStrictEqual(addCalls, [
			{
				job: JOB_NAMES.SEND_WELCOME_EMAIL,
				data: { userId: "user-42" },
				jobOptions: undefined,
			},
		]);
	});

	test("closes the queue so no connection is held by the web process", async () => {
		await enqueueWelcomeEmail("user-42", stubQueueModule);

		// A Queue left open pins its Redis connection to the web process for the
		// lifetime of the process, which is the cost the lazy import exists to
		// avoid.
		assert.deepStrictEqual(closeCalls, [true]);
	});

	test("closes the queue even when the add fails", async () => {
		addImpl = async () => {
			throw new Error("connect ECONNREFUSED redis://cache:6379");
		};

		await assert.rejects(
			enqueueWelcomeEmail("user-42", stubQueueModule),
			/ECONNREFUSED/,
		);
		assert.deepStrictEqual(closeCalls, [true]);
	});

	test("surfaces the add failure rather than swallowing it", async () => {
		addImpl = async () => {
			throw new Error("queue is closed");
		};

		// The route decides this is non-critical. The helper must not decide it on
		// the route's behalf, or a caller that cares would never hear about it.
		await assert.rejects(enqueueWelcomeEmail("user-42", stubQueueModule), {
			message: "queue is closed",
		});
	});

	test("a failing close does not mask a successful enqueue", async () => {
		let added = 0;

		await enqueueWelcomeEmail("user-42", () => ({
			createQueue: () => ({
				add: async () => {
					added++;
					return { id: "job-1" };
				},
				close: async () => {
					throw new Error("close failed");
				},
			}),
		}));

		// The job is on the queue. Whether the socket shut down cleanly is not
		// worth turning a delivered email into an error.
		assert.strictEqual(added, 1);
	});

	test("a failing close does not replace the add failure", async () => {
		addImpl = async () => {
			throw new Error("queue is closed");
		};

		await assert.rejects(
			enqueueWelcomeEmail("user-42", () => ({
				createQueue: () => ({
					add: async (job, data) => addImpl(job, data),
					close: async () => {
						throw new Error("close failed");
					},
				}),
			})),
			{ message: "queue is closed" },
		);
	});

	test("propagates a failure to load the queue module", async () => {
		const loadQueue = async () => {
			throw new Error("Cannot find module");
		};

		await assert.rejects(enqueueWelcomeEmail("user-42", loadQueue), {
			message: "Cannot find module",
		});
		assert.deepStrictEqual(closeCalls, []);
	});

	test("loads the queue module before building a queue", async () => {
		const order = [];
		const loadQueue = async () => {
			order.push("load");
			return {
				createQueue: () => {
					order.push("create");
					return { add: async () => {}, close: async () => {} };
				},
			};
		};

		await enqueueWelcomeEmail("user-42", loadQueue);

		// Loading first is what keeps BullMQ out of the module graph at load time;
		// a queue built from a not-yet-loaded module would have to be static.
		assert.deepStrictEqual(order, ["load", "create"]);
	});
});
