/**
 * Job Handler Registry
 * Maps job names to their handler functions.
 * Each handler receives (bullJob, logger) and returns a result object.
 */

import { JOB_NAMES } from "@usequark/quark-jobs";
import {
	handleSendResetPasswordEmail,
	handleSendVerificationEmail,
	handleSendWelcomeEmail,
} from "./email.js";
import { handleCleanupOrphanedFiles } from "./files.js";

export const jobHandlers = {
	[JOB_NAMES.SEND_WELCOME_EMAIL]: handleSendWelcomeEmail,
	[JOB_NAMES.SEND_VERIFY_EMAIL]: handleSendVerificationEmail,
	[JOB_NAMES.SEND_RESET_PASSWORD_EMAIL]: handleSendResetPasswordEmail,
	[JOB_NAMES.CLEANUP_ORPHANED_FILES]: handleCleanupOrphanedFiles,
};
