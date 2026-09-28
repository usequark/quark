import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import { jobDuration, jobQueueDepth, jobsProcessedTotal } from "../metrics.js";
import {
	addJob,
	checkQueueHealth,
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

	test("createQueue is idempotent - same instance on repeated calls", () => {
		q2 = createQueue("test-idempotent-queue");
		const again = createQueue("test-idempotent-queue");
		assert.strictEqual(q2, again, "should return the same queue instance");
	});
});

// ─── createQueue close safety ────────────────────────────────────────────────
// Regression: a closed queue used to stay in the singleton registry, so every
// later createQueue(name) handed back the same poisoned, unusable instance.
// Required behavior: close → evict → recreate → usable.

describe("createQueue - close safety", () => {
	const NAME = "test-close-recreate-queue";
	let queue;

	after(async () => {
		await queue?.close().catch(() => {});
	});

	test("closing a queue evicts it from the registry", async () => {
		queue = createQueue(NAME);
		assert.ok(
			getRegisteredQueues().has(NAME),
			"queue should be registered while open",
		);

		await queue.close();

		assert.ok(
			!getRegisteredQueues().has(NAME),
			"closed queue should be evicted from the registry",
		);
	});

	test("createQueue after close returns a fresh, usable queue", async () => {
		const first = queue; // the closed instance from the previous test

		queue = createQueue(NAME);

		assert.notStrictEqual(
			queue,
			first,
			"should build a new instance instead of returning the closed one",
		);
		assert.ok(
			getRegisteredQueues().has(NAME),
			"new instance should be registered",
		);

		// "Usable" means it can actually reach Redis and enqueue a job.
		// Use the public readiness primitive - `client` is not stable across
		// BullMQ majors and was removed in v6.
		await queue.waitUntilReady();
		const job = await queue.add("close-recreate-probe", { probe: true });
		assert.ok(job.id, "fresh queue should enqueue a job");

		await queue.obliterate({ force: true }).catch(() => {});
	});

	test("a queue closed outside the wrapper is still replaced", async () => {
		const stale = queue;
		// Bypass our evict-on-close wrapper and close via the prototype directly
		await Object.getPrototypeOf(stale).close.call(stale);

		queue = createQueue(NAME);

		assert.notStrictEqual(
			queue,
			stale,
			"a known-closed instance must never be handed out again",
		);
		assert.ok(getRegisteredQueues().has(NAME));
	});
});

// ─── addJob deduplication ─────────────────────────────────────────────────────
// Regression: dedup was hand-rolled with a raw `SET NX` against `queue.client`.
// BullMQ 6 removed that getter, so the `SET NX` threw, the best-effort `catch`
// swallowed it, and every "deduplicated" job was enqueued anyway - silently.
// These tests pin that dedup works through the public BullMQ option and that
// we never reach for BullMQ internals to do it.

describe("addJob - deduplication", () => {
	const NAME = "test-dedup-queue";
	let queue;

	before(() => {
		queue = createQueue(NAME);
	});

	after(async () => {
		await queue?.obliterate({ force: true }).catch(() => {});
		await queue?.close().catch(() => {});
	});

	test("a repeated dedupKey does not enqueue a second job", async () => {
		const first = await addJob(
			queue,
			"dedup-probe",
			{ n: 1 },
			{
				dedupKey: "probe-key",
				dedupTTL: 60,
			},
		);
		assert.ok(first?.id, "the first add should enqueue");

		// BullMQ throttles the duplicate instead of creating a second job.
		const second = await addJob(
			queue,
			"dedup-probe",
			{ n: 2 },
			{
				dedupKey: "probe-key",
				dedupTTL: 60,
			},
		);
		assert.strictEqual(
			second?.id,
			first.id,
			"a duplicate dedupKey must resolve to the already-queued job",
		);

		const waiting = await queue.getWaitingCount();
		assert.strictEqual(waiting, 1, "only one job should be waiting");
	});

	test("different dedupKeys enqueue independently", async () => {
		const a = await addJob(
			queue,
			"dedup-probe-b",
			{ n: 1 },
			{
				dedupKey: "probe-a",
				dedupTTL: 60,
			},
		);
		const b = await addJob(
			queue,
			"dedup-probe-b",
			{ n: 1 },
			{
				dedupKey: "probe-b",
				dedupTTL: 60,
			},
		);
		assert.notStrictEqual(
			a.id,
			b.id,
			"distinct keys must produce distinct jobs",
		);
	});

	test("no dedupKey means no deduplication", async () => {
		const a = await addJob(queue, "dedup-probe-none", { n: 1 });
		const b = await addJob(queue, "dedup-probe-none", { n: 1 });
		assert.notStrictEqual(a.id, b.id, "jobs without a dedupKey always enqueue");
	});
});

// ─── checkQueueHealth ─────────────────────────────────────────────────────────
// Uses the public `waitUntilReady()`; a healthy Redis must report healthy, not
// "unavailable" (which is what happened once BullMQ removed `queue.client`).

describe("checkQueueHealth", () => {
	test("reports healthy against a live Redis", async () => {
		assert.strictEqual(await checkQueueHealth(), true);
	});
});

// ─── updateQueueDepths ────────────────────────────────────────────────────────

describe("updateQueueDepths", () => {
	test("resolves without error when no queues are registered", async () => {
		// Create a fresh scenario - if no queues in the singleton map, just skip
		// We can't easily reset the singleton, so we just verify it doesn't throw
		await assert.doesNotReject(() => updateQueueDepths());
	});
});

// ─── createWorker auto-instrumentation ───────────────────────────────────────
// These tests require a live Redis connection.

describe("createWorker - metrics instrumentation", () => {
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
