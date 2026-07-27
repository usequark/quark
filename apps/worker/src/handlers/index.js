/**
 * Job Handler Registry
 * Maps job names to their handler functions.
 * Each handler receives (bullJob, logger) and returns a result object.
 */

import { JOB_NAMES } from "@techstream/quark-jobs";
import { handleAiAgentTask } from "./ai.js";
import { handleAnalyticsSync } from "./analytics-sync.js";
import { handleContextExtraction } from "./context-extraction.js";
import { handleConversationCompact } from "./conversation-compact.js";
import {
	handleSendGovernanceAlert,
	handleSendResetPasswordEmail,
	handleSendWelcomeEmail,
} from "./email.js";
import { handleCleanupOrphanedFiles } from "./files.js";
import { handleGovernanceCheck } from "./governance-check.js";
import { handleMonitorCheck } from "./monitor-check.js";
import { handleProjectReport } from "./project-report.js";
import {
	handleRailwayMetricsSync,
	handleRailwayStateSync,
	handleRailwayUsageSync,
} from "./railway-sync.js";
import { handleTaskContextExtraction } from "./task-context-extraction.js";
import { handleWorkspaceBillingSync } from "./workspace-billing-sync.js";

export const jobHandlers = {
	[JOB_NAMES.SEND_WELCOME_EMAIL]: handleSendWelcomeEmail,
	[JOB_NAMES.SEND_RESET_PASSWORD_EMAIL]: handleSendResetPasswordEmail,
	[JOB_NAMES.CLEANUP_ORPHANED_FILES]: handleCleanupOrphanedFiles,
	[JOB_NAMES.AI_AGENT_TASK]: handleAiAgentTask,
	[JOB_NAMES.AI_CONTEXT_EXTRACTION]: handleContextExtraction,
	[JOB_NAMES.AI_TASK_CONTEXT_EXTRACTION]: handleTaskContextExtraction,
	[JOB_NAMES.AI_CONVERSATION_COMPACT]: handleConversationCompact,
	[JOB_NAMES.SYNC_RAILWAY_COSTS]: handleRailwayUsageSync,
	[JOB_NAMES.SYNC_RAILWAY_DEPLOYMENTS]: handleRailwayStateSync,
	[JOB_NAMES.SYNC_RAILWAY_METRICS]: handleRailwayMetricsSync,
	[JOB_NAMES.SYNC_UMAMI_ANALYTICS]: handleAnalyticsSync,
	[JOB_NAMES.CHECK_MONITORS]: handleMonitorCheck,
	[JOB_NAMES.CHECK_PROJECT_GOVERNANCE]: handleGovernanceCheck,
	[JOB_NAMES.SEND_GOVERNANCE_ALERT]: handleSendGovernanceAlert,
	[JOB_NAMES.GENERATE_PROJECT_REPORT]: handleProjectReport,
	[JOB_NAMES.SYNC_WORKSPACE_BILLING]: handleWorkspaceBillingSync,
};
