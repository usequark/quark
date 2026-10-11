/**
 * Queue name and enqueue mechanics shared by every transactional email the web
 * service sends.
 *
 * The queue module is imported dynamically from inside this file, so callers
 * that import a thin wrapper statically never pull BullMQ into their module
 * graph. That matters most for `/api/auth/*` routes, which are reachable on the
 * web service: a module-scope `createQueue` import both loaded BullMQ at
 * startup and pinned a Redis connection to the web process for as long as the
 * process lived.
 *
 * It also gives each route a static boundary to substitute in tests. `mock.module`
 * intercepts a dynamic import only when the importing module registered the
 * mock, so a dynamic import made by the route itself cannot be mocked from the
 * route's test. A static import of a wrapper module can.
 *
 * The queue name is duplicated here rather than imported from `@<scope>/jobs`
 * on purpose: `jobs` is an optional scaffold package, and importing it from the
 * web module broke the build of every project that declined it. The
 * `packages/cli` scaffold-drift test fails when this copy diverges from the
 * jobs definitions.
 */
export const EMAIL_QUEUE = "email-queue";

/**
 * Loads the queue module on demand.
 *
 * Kept as a named binding rather than an inline `import()` so it can be
 * substituted — see `loadQueue` on {@link enqueueEmailJob}.
 *
 * @returns {Promise<typeof import("@usequark/quark-core/queue")>}
 */
function loadQueueModule() {
	return import("@usequark/quark-core/queue");
}

/**
 * Enqueues an email job, closing the queue either way.
 *
 * @param {string} jobName - Job name from the jobs package (e.g.
 *   `SEND_WELCOME_EMAIL`). The worker rejects an unknown name, so this is not
 *   validated client-side — a helper that silently accepted a typo would hide
 *   the rejection in a log line.
 * @param {object} data - Job payload, validated by the worker's handler.
 * @param {() => Promise<{ createQueue: (name: string, options?: object) => object }>} [loadQueue]
 *   How to obtain the queue module. Defaults to the dynamic import above;
 *   overridden in tests.
 * @returns {Promise<void>}
 * @throws Whatever `createQueue` or `add` throws. The queue is closed either
 *   way, so a caller that swallows the error still leaves no connection behind.
 */
export async function enqueueEmailJob(
	jobName,
	data,
	loadQueue = loadQueueModule,
) {
	const { createQueue } = await loadQueue();
	const queue = createQueue(EMAIL_QUEUE);

	try {
		await queue.add(jobName, data);
	} finally {
		// Never let a failing close mask the enqueue outcome — the caller only
		// needs to know whether the job reached the queue.
		await queue.close().catch(() => {});
	}
}
