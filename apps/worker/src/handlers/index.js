/**
 * Job Handler Registry
 * Maps job names to their handler functions.
 * Each handler receives (bullJob, logger) and returns a result object.
 */

import { JOB_NAMES } from "@techstream/quark-jobs";
import {
	handleAiAgentTask,
	handleAiHealthCheck,
	handleAiSessionCreate,
} from "./ai.js";
import {
	handleSendResetPasswordEmail,
	handleSendWelcomeEmail,
} from "./email.js";
import { handleCleanupOrphanedFiles } from "./files.js";

export const jobHandlers = {
	[JOB_NAMES.SEND_WELCOME_EMAIL]: handleSendWelcomeEmail,
	[JOB_NAMES.SEND_RESET_PASSWORD_EMAIL]: handleSendResetPasswordEmail,
	[JOB_NAMES.CLEANUP_ORPHANED_FILES]: handleCleanupOrphanedFiles,
	[JOB_NAMES.AI_AGENT_TASK]: handleAiAgentTask,
	[JOB_NAMES.AI_SESSION_CREATE]: handleAiSessionCreate,
	[JOB_NAMES.AI_HEALTH_CHECK]: handleAiHealthCheck,
};
