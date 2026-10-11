import { enqueueEmailJob } from "./enqueue-email-job.js";

// Re-exported so callers that already import the welcome helper keep their
// import site, and so its test still asserts the queue name in one place.
export { EMAIL_QUEUE } from "./enqueue-email-job.js";

/**
 * Job name for the signup welcome email.
 *
 * Mirrors `JOB_NAMES.SEND_WELCOME_EMAIL` in the optional `@<scope>/jobs`
 * package (see `enqueue-email-job.js` for why it is duplicated). The
 * `packages/cli` scaffold-drift test fails when the two copies diverge.
 */
export const SEND_WELCOME_EMAIL = "send-welcome-email";

/**
 * Enqueues the post-signup welcome email for a newly created user.
 *
 * @param {string} userId - The user to welcome. The worker rejects a job with
 *   no userId, so this is required rather than defaulted.
 * @param {() => Promise<{ createQueue: (name: string, options?: object) => object }>} [loadQueue]
 *   Queue-module loader, overridden in tests. See {@link enqueueEmailJob}.
 * @returns {Promise<void>}
 */
export async function enqueueWelcomeEmail(userId, loadQueue) {
	return enqueueEmailJob(SEND_WELCOME_EMAIL, { userId }, loadQueue);
}
