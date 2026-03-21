import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import { jobDuration, jobQueueDepth, jobsProcessedTotal } from "../metrics.js";
import {
	createQueue,
	createWorker,
	getRegisteredQueues,
	updateQueueDepths,
} from "./index.js";

// ─── getRegisteredQueues ──────────────────────────────────────────────────────

describe("getRegisteredQueues", () => {
	let q1;
	let q2;

	after(async () => {
		await q1?.close().catch(() => {});
		await q2?.close().catch(() => {});
	});

	test("returns the internal queues Map", () => {
		const result = getRegisteredQueues();
		assert.ok(result instanceof Map, "should be a Map");
	});

	test("reflects queues registered via createQueue", () => {
		const before = getRegisteredQueues().size;
		q1 = createQueue("test-registry-queue");
		assert.strictEqual(getRegisteredQueues().size, before + 1);
		assert.ok(getRegisteredQueues().has("test-registry-queue"));
	});

	test("createQueue is idempotent — same instance on repeated calls", () => {
		q2 = createQueue("test-idempotent-queue");
		const again = createQueue("test-idempotent-queue");
		assert.strictEqual(q2, again, "should return the same queue instance");
	});
});

// ─── updateQueueDepths ────────────────────────────────────────────────────────

describe("updateQueueDepths", () => {
	test("resolves without error when no queues are registered", async () => {
		// Create a fresh scenario — if no queues in the singleton map, just skip
		// We can't easily reset the singleton, so we just verify it doesn't throw
		await assert.doesNotReject(() => updateQueueDepths());
	});
});

// ─── createWorker auto-instrumentation ───────────────────────────────────────
// These tests require a live Redis connection.

describe("createWorker — metrics instrumentation", () => {
	const TEST_QUEUE = "test-metrics-queue";
	let queue;

	before(async () => {
		queue = createQueue(TEST_QUEUE);
	});

	after(async () => {
		await queue?.close().catch(() => {});
	});

	test("jobsProcessedTotal increments on job completion", async () => {
		const before =
			jobsProcessedTotal.values.get(
				`{queue="${TEST_QUEUE}",status="completed"}`,
			) ?? 0;

		const worker = createWorker(TEST_QUEUE, async () => ({ ok: true }), {
			concurrency: 1,
		});

		try {
			// Add a job and wait for it to complete
			await new Promise((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("Job did not complete in time")),
					5000,
				);
				worker.once("completed", () => {
					clearTimeout(timeout);
					resolve();
				});
				worker.once("error", (err) => {
					clearTimeout(timeout);
					reject(err);
				});
				queue.add("test-job", { test: true }).catch(reject);
			});

			const after =
				jobsProcessedTotal.values.get(
					`{queue="${TEST_QUEUE}",status="completed"}`,
				) ?? 0;
			assert.ok(after > before, "completed counter should have incremented");
		} finally {
			await worker.close().catch(() => {});
		}
	});

	test("jobsProcessedTotal increments on job failure", async () => {
		const before =
			jobsProcessedTotal.values.get(
				`{queue="${TEST_QUEUE}",status="failed"}`,
			) ?? 0;

		const worker = createWorker(
			TEST_QUEUE,
			async () => {
				throw new Error("intentional failure");
			},
			{ concurrency: 1 },
		);

		try {
			await new Promise((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("Job did not fail in time")),
					5000,
				);
				worker.once("failed", () => {
					clearTimeout(timeout);
					resolve();
				});
				worker.once("error", (err) => {
					clearTimeout(timeout);
					reject(err);
				});
				// attempts:1 so it fails immediately without retries
				queue
					.add("test-fail-job", { test: true }, { attempts: 1 })
					.catch(reject);
			});

			const after =
				jobsProcessedTotal.values.get(
					`{queue="${TEST_QUEUE}",status="failed"}`,
				) ?? 0;
			assert.ok(after > before, "failed counter should have incremented");
		} finally {
			await worker.close().catch(() => {});
		}
	});

	test("jobDuration records a histogram observation on completion", async () => {
		const beforeCount =
			jobDuration.values.get(`{name="timed-job",queue="${TEST_QUEUE}"}`)
				?.count ?? 0;

		const worker = createWorker(TEST_QUEUE, async () => ({ ok: true }), {
			concurrency: 1,
		});

		try {
			await new Promise((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("Timed job did not complete")),
					5000,
				);
				worker.once("completed", () => {
					clearTimeout(timeout);
					resolve();
				});
				worker.once("error", (err) => {
					clearTimeout(timeout);
					reject(err);
				});
				queue.add("timed-job", { test: true }).catch(reject);
			});

			const afterCount =
				jobDuration.values.get(`{name="timed-job",queue="${TEST_QUEUE}"}`)
					?.count ?? 0;
			assert.ok(afterCount > beforeCount, "histogram count should have grown");
		} finally {
			await worker.close().catch(() => {});
		}
	});

	test("updateQueueDepths sets job_queue_depth gauge", async () => {
		// Add a few jobs to create a backlog, then update depths
		await queue.addBulk([
			{ name: "depth-test", data: {} },
			{ name: "depth-test", data: {} },
		]);

		await updateQueueDepths();

		const depth = jobQueueDepth.values.get(`{queue="${TEST_QUEUE}"}`) ?? 0;
		// We added 2 jobs; depth should be >= 2 (could be higher if prior test jobs remain)
		assert.ok(depth >= 2, `expected depth >= 2, got ${depth}`);

		// Drain queue so it doesn't interfere with other tests
		await queue.obliterate({ force: true }).catch(() => {});
	});
});
