import { enqueueEmailJob } from "./enqueue-email-job.js";

/**
 * Job name for the email-verification message.
 *
 * Mirrors `JOB_NAMES.SEND_VERIFY_EMAIL` in the optional `@<scope>/jobs`
 * package (see `enqueue-email-job.js` for why it is duplicated). The
 * `packages/cli` scaffold-drift test fails when the two copies diverge.
 */
export const SEND_VERIFY_EMAIL = "send-verify-email";

/**
 * Enqueues the verification email a new account needs to confirm its address.
 *
 * @param {string} userId - The user whose address is being confirmed. The worker
 *   resolves the address from this id rather than trusting the caller, so an
 *   attacker cannot enqueue a verification mail to an address they do not own.
 * @param {string} verifyUrl - Absolute, single-use confirmation link.
 * @param {() => Promise<{ createQueue: (name: string, options?: object) => object }>} [loadQueue]
 *   Queue-module loader, overridden in tests. See {@link enqueueEmailJob}.
 * @returns {Promise<void>}
 */
export async function enqueueVerificationEmail(userId, verifyUrl, loadQueue) {
	return enqueueEmailJob(SEND_VERIFY_EMAIL, { userId, verifyUrl }, loadQueue);
}
