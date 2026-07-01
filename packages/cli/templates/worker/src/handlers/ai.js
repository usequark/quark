/**
 * AI Job Handler
 * Dispatches prompts to the OpenCode server via the TypeScript SDK.
 * The OpenCode server runs on Railway internal networking at http://opencode.railway.internal:4096.
 */

import { createLogger } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";
import { JOB_NAMES } from "@techstream/quark-jobs";

const logger = createLogger("worker:ai");

/**
 * Handles an AI agent task job.
 * Creates an OpenCode session and sends a prompt, returning the result.
 *
 * Job data expected:
 *   - prompt: string — the prompt text to send
 *   - agent: string — the agent to use (e.g., "assistant", "strategist")
 *   - sessionTitle: string — optional title for the session
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleAiAgentTask(bullJob, logger) {
	const { prompt, agent = "assistant", sessionTitle } = bullJob.data;

	if (!prompt) {
		throw new AppError(
			"AI agent task requires a prompt",
			400,
			"AI_PROMPT_REQUIRED",
		);
	}

	const baseUrl =
		process.env.OPENCODE_SERVER_URL || "http://opencode.railway.internal:4096";

	logger.info("Dispatching AI agent task", {
		job: JOB_NAMES.AI_AGENT_TASK,
		agent,
		sessionTitle: sessionTitle || "(untitled)",
		baseUrl,
	});

	try {
		// Dynamic import so the worker doesn't need @opencode-ai/sdk at startup
		// if the AI feature isn't configured
		const { createOpencodeClient } = await import("@opencode-ai/sdk");

		const client = createOpencodeClient({ baseUrl });

		const session = await client.session.create({
			body: {
				title: sessionTitle || `AI Task: ${agent}`,
			},
		});

		const result = await client.session.prompt({
			path: { id: session.id },
			body: {
				agent,
				parts: [{ type: "text", text: prompt }],
			},
		});

		logger.info("AI agent task completed", {
			job: JOB_NAMES.AI_AGENT_TASK,
			sessionId: session.id,
			agent,
		});

		return {
			sessionId: session.id,
			output: result.data,
		};
	} catch (error) {
		logger.error("AI agent task failed", {
			job: JOB_NAMES.AI_AGENT_TASK,
			error: error.message,
			agent,
		});
		throw new AppError(
			`AI agent task failed: ${error.message}`,
			502,
			"AI_AGENT_TASK_FAILED",
		);
	}
}

/**
 * Handles an AI session create job.
 * Creates a new OpenCode session and returns the session ID.
 *
 * Job data expected:
 *   - title: string — optional session title
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleAiSessionCreate(bullJob, logger) {
	const { title } = bullJob.data;

	const baseUrl =
		process.env.OPENCODE_SERVER_URL || "http://opencode.railway.internal:4096";

	logger.info("Creating AI session", {
		job: JOB_NAMES.AI_SESSION_CREATE,
		title: title || "(untitled)",
	});

	try {
		const { createOpencodeClient } = await import("@opencode-ai/sdk");

		const client = createOpencodeClient({ baseUrl });

		const session = await client.session.create({
			body: {
				title: title || "AI Session",
			},
		});

		logger.info("AI session created", {
			job: JOB_NAMES.AI_SESSION_CREATE,
			sessionId: session.id,
		});

		return {
			sessionId: session.id,
		};
	} catch (error) {
		logger.error("AI session creation failed", {
			job: JOB_NAMES.AI_SESSION_CREATE,
			error: error.message,
		});
		throw new AppError(
			`AI session creation failed: ${error.message}`,
			502,
			"AI_SESSION_CREATE_FAILED",
		);
	}
}

/**
 * Handles an AI health check job.
 * Calls GET /health on the OpenCode server to verify connectivity.
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleAiHealthCheck(bullJob, logger) {
	const baseUrl =
		process.env.OPENCODE_SERVER_URL || "http://opencode.railway.internal:4096";

	logger.info("Checking AI server health", {
		job: JOB_NAMES.AI_HEALTH_CHECK,
		baseUrl,
	});

	try {
		const response = await fetch(`${baseUrl}/health`);

		if (!response.ok) {
			throw new Error(
				`Health check returned ${response.status}: ${response.statusText}`,
			);
		}

		const data = await response.json();

		logger.info("AI server health check passed", {
			job: JOB_NAMES.AI_HEALTH_CHECK,
			serverStatus: data,
		});

		return {
			status: "ok",
			serverStatus: data,
		};
	} catch (error) {
		logger.error("AI server health check failed", {
			job: JOB_NAMES.AI_HEALTH_CHECK,
			error: error.message,
		});
		throw new AppError(
			`AI server health check failed: ${error.message}`,
			502,
			"AI_HEALTH_CHECK_FAILED",
		);
	}
}
