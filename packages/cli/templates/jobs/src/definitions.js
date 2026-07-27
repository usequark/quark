export const JOB_QUEUES = {
	EMAIL: "email-queue",
	FILES: "files-queue",
	AI: "ai-queue",
	DEFAULT: "default-queue",
};

export const JOB_NAMES = {
	SEND_WELCOME_EMAIL: "send-welcome-email",
	SEND_RESET_PASSWORD_EMAIL: "send-reset-password-email",
	CLEANUP_ORPHANED_FILES: "cleanup-orphaned-files",
	AI_AGENT_TASK: "ai-agent-task",
	AI_CONTEXT_EXTRACTION: "ai-context-extraction",
	AI_TASK_CONTEXT_EXTRACTION: "ai-task-context-extraction",
	AI_CONVERSATION_COMPACT: "ai-conversation-compact",
	// Project Manager
	SYNC_RAILWAY_COSTS: "sync-railway-costs",
	SYNC_RAILWAY_DEPLOYMENTS: "sync-railway-deployments",
	SYNC_RAILWAY_METRICS: "sync-railway-metrics",
	SYNC_UMAMI_ANALYTICS: "sync-umami-analytics",
	CHECK_MONITORS: "check-monitors",
	CHECK_PROJECT_GOVERNANCE: "check-project-governance",
	SEND_GOVERNANCE_ALERT: "send-governance-alert",
	GENERATE_PROJECT_REPORT: "generate-project-report",
	SYNC_WORKSPACE_BILLING: "sync-workspace-billing",
};
