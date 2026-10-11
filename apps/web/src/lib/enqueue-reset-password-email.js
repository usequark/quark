import { enqueueEmailJob } from "./enqueue-email-job.js";

/**
 * Job name for the password-reset message.
 *
 * Mirrors `JOB_NAMES.SEND_RESET_PASSWORD_EMAIL` in the optional `@<scope>/jobs`
 * package (see `enqueue-email-job.js` for why it is duplicated). The
 * `packages/cli` scaffold-drift test fails when the two copies diverge.
 *
 * Until this helper existed, no scaffolded route enqueued this job: the worker
 * handler and the email template shipped, but nothing ever called them. The
 * forgot-password route is the caller.
 */
export const SEND_RESET_PASSWORD_EMAIL = "send-reset-password-email";

/**
 * Enqueues the password-reset email for a user who requested one.
 *
 * @param {string} userId - The user to email. The worker resolves the address
 *   from this id, so the reset link cannot be sent to an attacker-chosen
 *   mailbox.
 * @param {string} resetUrl - Absolute, single-use reset link.
 * @param {() => Promise<{ createQueue: (name: string, options?: object) => object }>} [loadQueue]
 *   Queue-module loader, overridden in tests. See {@link enqueueEmailJob}.
 * @returns {Promise<void>}
 */
export async function enqueueResetPasswordEmail(userId, resetUrl, loadQueue) {
	return enqueueEmailJob(
		SEND_RESET_PASSWORD_EMAIL,
		{ userId, resetUrl },
		loadQueue,
	);
}
