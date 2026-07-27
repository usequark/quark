/**
 * AI Job Handler
 * Handles persistent AI conversations via OpenRouter.
 */

import { getSharedRedisClient } from "@techstream/quark-config";
import { createLogger, createQueue } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { JOB_NAMES, JOB_QUEUES } from "@techstream/quark-jobs";
import { completeWithTools } from "../lib/openrouter.js";
import { getModelBudget } from "../lib/tokens.js";
import {
	executeTool,
	getAllFilteredToolDefinitions,
} from "../lib/tools/index.js";
import { buildPromptMessages, shouldCompact } from "../lib/truncation.js";

const _logger = createLogger("worker:ai");

/**
 * Publish an event to Redis for SSE streaming.
 * Non-fatal - failures are logged and swallowed.
 *
 * @param {string} conversationId
 * @param {object} data - Event data to publish
 */
async function publishToRedis(conversationId, data) {
	try {
		const client = await getSharedRedisClient();
		if (!client) return;
		const channel = `ai:stream:${conversationId}`;
		await client.publish(channel, JSON.stringify(data));
	} catch (error) {
		_logger.warn("Failed to publish to Redis (non-fatal)", {
			error: error.message,
			conversationId,
		});
	}
}

/**
 * Handles an AI agent task job.
 * Loads conversation from DB, calls OpenRouter, saves assistant message.
 *
 * Job data expected:
 *   - conversationId: string
 *   - userId: string
 *   - message: string
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleAiAgentTask(bullJob, logger) {
	const { conversationId, userId, message } = bullJob.data;

	if (!conversationId) {
		throw new AppError(
			"AI agent task requires a conversationId",
			400,
			"AI_CONVERSATION_ID_REQUIRED",
		);
	}

	if (!message) {
		throw new AppError(
			"AI agent task requires a message",
			400,
			"AI_MESSAGE_REQUIRED",
		);
	}

	logger.info("Dispatching AI agent task", {
		job: JOB_NAMES.AI_AGENT_TASK,
		conversationId,
		userId,
	});

	// Look up user role for authorization-aware tool filtering
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { role: true },
	});
	if (!user) {
		throw new AppError("User not found", 404, "USER_NOT_FOUND");
	}

	try {
		// Load conversation history (all messages - truncation module handles limiting)
		const conversation = await prisma.aiConversation.findUnique({
			where: { id: conversationId },
			include: {
				messages: {
					orderBy: { createdAt: "asc" },
				},
			},
		});

		if (!conversation || conversation.deletedAt) {
			throw new AppError(
				"Conversation not found",
				404,
				"CONVERSATION_NOT_FOUND",
			);
		}

		// Build messages for OpenRouter with truncation
		const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
		const systemPrompt =
			"You are a helpful AI assistant for a CRM system. You have access to tools for managing contacts, companies, deals, and business context. Be concise and helpful.";

		const {
			messages: openrouterMessages,
			wasTruncated,
			droppedCount,
			estimatedTokens,
		} = buildPromptMessages({
			messages: conversation.messages,
			summary: conversation.summary,
			summaryTokens: conversation.summaryTokens,
			model,
			systemPrompt,
		});

		// Track dropped messages for compaction
		const droppedMessages = conversation.messages.slice(0, droppedCount);

		if (wasTruncated) {
			logger.info("Conversation truncated", {
				conversationId,
				droppedCount,
				estimatedTokens,
			});
		}

		// Publish thinking event before calling the model
		await publishToRedis(conversationId, {
			type: "thinking",
			content: "Analyzing your request...",
		});

		// Enhanced onToolCall that publishes action events
		const enhancedOnToolCall = async (toolName, input) => {
			await publishToRedis(conversationId, {
				type: "action",
				action: `Executing: ${toolName}`,
			});
			return executeTool(toolName, input);
		};

		// Call OpenRouter with role-filtered tools; stream final tokens over SSE
		const tools = getAllFilteredToolDefinitions(user.role);
		const result = await completeWithTools({
			model,
			messages: openrouterMessages,
			tools,
			budget: getModelBudget(model),
			onToolCall: enhancedOnToolCall,
			onStream: async (content) => {
				await publishToRedis(conversationId, {
					type: "token",
					content,
				});
			},
		});

		// Extract assistant message
		const assistantContent = result.choices?.[0]?.message?.content || "";

		// Save assistant message
		const assistantMessage = await prisma.aiMessage.create({
			data: {
				conversationId,
				role: "assistant",
				content: assistantContent,
				toolCalls: result.choices?.[0]?.message?.tool_calls || undefined,
				cost: result.totalCost || undefined,
				tokens: result.usage?.total_tokens || undefined,
			},
		});

		// Update conversation timestamp
		await prisma.aiConversation.update({
			where: { id: conversationId },
			data: { updatedAt: new Date() },
		});

		// Publish final message event (full content) after token stream
		await publishToRedis(conversationId, {
			type: "message",
			content: assistantContent,
			messageId: assistantMessage.id,
			cost: result.totalCost,
			tokens: result.usage?.total_tokens,
		});

		// Publish done event
		await publishToRedis(conversationId, { type: "done" });

		// Check if compaction should be triggered
		const tokenBudget = getModelBudget(model);

		// Only check dropped messages for compaction (not entire history)
		if (
			droppedCount > 0 &&
			shouldCompact({ messages: droppedMessages, tokenBudget })
		) {
			logger.info("Triggering background compaction", { conversationId });
			// Fire and forget - don't block the response
			summarizeConversation(droppedMessages, model)
				.then(async ({ summary, tokenCount }) => {
					if (summary) {
						await prisma.aiConversation.update({
							where: { id: conversationId },
							data: {
								summary,
								summaryTokens: tokenCount,
								summaryUpdatedAt: new Date(),
							},
						});
						logger.info("Conversation compacted", {
							conversationId,
							summaryTokens: tokenCount,
						});
					}
				})
				.catch((err) => {
					logger.error("Background compaction failed", {
						conversationId,
						error: err.message,
					});
			try {
				const aiQueue = createQueue(JOB_QUEUES.AI);
				await aiQueue.add(JOB_NAMES.AI_CONVERSATION_COMPACT, {
					conversationId,
					droppedCount,
					model,
				});
				logger.info("Enqueued conversation compaction", {
					conversationId,
					droppedCount,
				});
			} catch (error) {
				// Non-fatal — AI response already delivered; don't fail/retry the agent task
				logger.error("Failed to enqueue conversation compaction", {
					conversationId,
					droppedCount,
					error: error.message,
				});
			}
		}

		logger.info("AI agent task completed", {
			job: JOB_NAMES.AI_AGENT_TASK,
			conversationId,
			messageId: assistantMessage.id,
			cost: result.totalCost,
		});

		return {
			messageId: assistantMessage.id,
			content: assistantContent,
			cost: result.totalCost,
			tokens: result.usage?.total_tokens,
		};
	} catch (error) {
		// Publish error event to SSE before re-throwing
		try {
			await publishToRedis(conversationId, {
				type: "error",
				error: error.message || "AI agent task failed",
			});
		} catch {
			// Non-fatal — error publishing is best-effort
		}

		logger.error("AI agent task failed", {
			job: JOB_NAMES.AI_AGENT_TASK,
			error: error.message,
			conversationId,
		});

		// Propagate existing AppError without re-wrapping
		if (error instanceof AppError) throw error;

		throw new AppError(
			`AI agent task failed: ${error.message}`,
			error.statusCode || 502,
			"AI_AGENT_TASK_FAILED",
		);
	}
}
