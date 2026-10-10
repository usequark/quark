import { JOB_NAMES, JOB_QUEUES } from "@usequark/quark-jobs";

/**
 * Loads the queue module on demand.
 *
 * Kept as a named binding rather than an inline `import()` so it can be
 * substituted — see `loadQueue` on {@link enqueueWelcomeEmail}.
 *
 * @returns {Promise<typeof import("@usequark/quark-core/queue")>}
 */
function loadQueueModule() {
	return import("@usequark/quark-core/queue");
}

/**
 * Enqueues the post-signup welcome email for a newly created user.
 *
 * This lives in its own module for two reasons.
 *
 * The queue module is imported dynamically from inside this file, so callers
 * that import *this* statically never pull BullMQ into their module graph. That
 * matters most for `/api/auth/register`, which is reachable on the web service:
 * a module-scope `createQueue` import both loaded BullMQ at startup and pinned a
 * Redis connection to the web process for as long as the process lived.
 *
 * It also gives the route a static boundary to substitute in tests. `mock.module`
 * intercepts a dynamic import only when the importing module registered the mock,
 * so a dynamic import made by the route itself cannot be mocked from the route's
 * test. A static import of this module can.
 *
 * @param {string} userId - The user to welcome. The worker rejects a job with
 *   no userId, so this is required rather than defaulted.
 * @param {() => Promise<{ createQueue: (name: string, options?: object) => object }>} [loadQueue]
 *   How to obtain the queue module. Defaults to the dynamic import above;
 *   overridden in tests.
 * @returns {Promise<void>}
 * @throws Whatever `createQueue` or `add` throws. The queue is closed either
 *   way, so a caller that swallows the error still leaves no connection behind.
 */
export async function enqueueWelcomeEmail(userId, loadQueue = loadQueueModule) {
	const { createQueue } = await loadQueue();
	const queue = createQueue(JOB_QUEUES.EMAIL);

	try {
		await queue.add(JOB_NAMES.SEND_WELCOME_EMAIL, { userId });
	} finally {
		// Never let a failing close mask the enqueue outcome — the caller only
		// needs to know whether the job reached the queue.
		await queue.close().catch(() => {});
	}
}
