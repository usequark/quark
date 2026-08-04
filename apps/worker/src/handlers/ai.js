/**
 * AI Job Handler
 * Handles persistent AI conversations via OpenRouter.
 */

import { recordToolEvent } from "@techstream/quark-ai/audit";
import {
	getUserToolAccessLevel,
	waitForToolConfirmation,
} from "@techstream/quark-ai/permissions";
import { getSharedRedisClient } from "@techstream/quark-config";
import { createLogger, createQueue } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { JOB_NAMES, JOB_QUEUES } from "@techstream/quark-jobs";
import { complete, completeWithTools } from "../lib/openrouter.js";
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
 * Human-readable labels for tool actions shown in SSE events.
 * Maps tool names (snake_case) to user-facing action descriptions.
 */
const toolActionLabels = {
	search_contacts: "Searching contacts",
	create_contact: "Creating contact",
	update_contact: "Updating contact",
	search_companies: "Searching companies",
	create_company: "Creating company",
	update_company: "Updating company",
	search_deals: "Searching deals",
	create_deal: "Creating deal",
	update_deal: "Updating deal",
	get_conversation_history: "Reading conversation history",
	get_context: "Reading context",
	create_context: "Saving context",
	update_context: "Updating context",
	delete_context: "Deleting context",
	search_context: "Searching context",
	search_jobs: "Searching jobs",
	web_search: "Searching the web",
};

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

		// Stall-retry race detection: check if another job already responded.
		// BullMQ retries can cause duplicate jobs — if an assistant message was
		// created after the user's most recent message, skip to avoid duplicates.
		const latestAssistantMessage = conversation.messages
			.filter((m) => m.role === "ASSISTANT")
			.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

		const userMessages = conversation.messages.filter((m) => m.role === "USER");
		const lastUserMessage = userMessages[userMessages.length - 1];
		if (latestAssistantMessage && lastUserMessage) {
			const assistantTime = new Date(
				latestAssistantMessage.createdAt,
			).getTime();
			const userTime = new Date(lastUserMessage.createdAt).getTime();
			if (assistantTime > userTime) {
				logger.info(
					"Skipping duplicate job — conversation already has a response",
					{
						conversationId,
						lastAssistantId: latestAssistantMessage.id,
					},
				);
				// Publish done to close any hanging SSE
				try {
					const client = await getSharedRedisClient();
					if (client) {
						await client.publish(
							`ai:stream:${conversationId}`,
							JSON.stringify({ type: "done" }),
						);
					}
				} catch {}
				return {
					skipped: true,
					messageId: latestAssistantMessage.id,
					content: latestAssistantMessage.content,
				};
			}
		}

		// Build messages for OpenRouter with truncation
		const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
		const systemPrompt =
			"You are a helpful AI assistant for a CRM system. You have access to tools for managing contacts, companies, deals, and business context. Be concise and helpful. IMPORTANT: If a tool result is truncated, work with the data you already have rather than retrying the same query. The truncation message is a hint to use more specific filters next time, not an instruction to retry.";

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

		// Enhanced onToolCall: enforce per-user tool permissions, then execute
		const enhancedOnToolCall = async (toolName, input) => {
			const accessLevel = await getUserToolAccessLevel(userId, toolName);

			if (accessLevel === "disabled") {
				await recordToolEvent({
					userId,
					conversationId,
					toolName,
					input,
					status: "skipped",
					reason: "disabled",
				});
				await publishToRedis(conversationId, {
					type: "tool_skipped",
					toolName,
					reason: "disabled",
				});
				return {
					skipped: true,
					reason: "Tool disabled by user",
				};
			}

			if (accessLevel === "confirm") {
				const callId = `${conversationId}-${toolName}-${Date.now()}`;
				await recordToolEvent({
					userId,
					conversationId,
					toolName,
					input,
					status: "proposed",
					callId,
				});
				await publishToRedis(conversationId, {
					type: "tool_proposal",
					toolName,
					input,
					callId,
				});
				await publishToRedis(conversationId, {
					type: "action",
					action: `Waiting for approval: ${toolActionLabels[toolName] || toolName}`,
				});

				const confirmation = await waitForToolConfirmation(callId);
				if (!confirmation.approved) {
					await recordToolEvent({
						userId,
						conversationId,
						toolName,
						input,
						status: "denied",
						reason: confirmation.timedOut ? "timed_out" : "denied",
						callId,
					});
					await publishToRedis(conversationId, {
						type: "tool_skipped",
						toolName,
						reason: confirmation.timedOut ? "timeout" : "denied",
					});
					return {
						skipped: true,
						reason: "Tool denied by user",
					};
				}
				await recordToolEvent({
					userId,
					conversationId,
					toolName,
					input,
					status: "approved",
					callId,
				});
			} else {
				await recordToolEvent({
					userId,
					conversationId,
					toolName,
					input,
					status: "auto_executed",
				});
			}

			await publishToRedis(conversationId, {
				type: "action",
				action: toolActionLabels[toolName] || `Performing: ${toolName}`,
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

		// Auto-generate title for conversations still using the default name.
		// Retries on every exchange until it succeeds.
		if (conversation.title === "New session") {
			try {
				const firstUserMessage = conversation.messages.find(
					(m) => m.role === "USER",
				);
				if (firstUserMessage?.content?.trim()) {
					let generatedTitle = null;

					// Try AI-powered title generation first
					try {
						const titleResult = await complete({
							model: "deepseek/deepseek-v4-flash",
							messages: [
								{
									role: "system",
									content:
										"Generate a concise title (max 6 words) for this conversation based on the user's first message. Return ONLY the title, no quotes, no explanation.",
								},
								{ role: "user", content: firstUserMessage.content },
							],
							options: { max_tokens: 20, temperature: 0.3 },
						});

						const aiTitle = titleResult.choices?.[0]?.message?.content?.trim();
						if (aiTitle && aiTitle.length > 0 && aiTitle.length <= 100) {
							generatedTitle = aiTitle;
						}
					} catch (aiError) {
						logger.warn("AI title generation failed, using fallback", {
							conversationId,
							error: aiError.message,
						});
					}

					// Fallback: use first 50 chars of first user message
					if (!generatedTitle) {
						generatedTitle = firstUserMessage.content
							.replace(/\s+/g, " ")
							.trim()
							.slice(0, 50);
					}

					if (generatedTitle) {
						await prisma.aiConversation.update({
							where: { id: conversationId },
							data: { title: generatedTitle },
						});
						logger.info("Set conversation title", {
							conversationId,
							title: generatedTitle,
						});

						// Publish title update event to refresh sidebar
						await publishToRedis(conversationId, {
							type: "title",
							title: generatedTitle,
						});
					}
				}
			} catch (error) {
				// Non-fatal — don't let title generation fail the job
				logger.warn("Failed to set conversation title", {
					conversationId,
					error: error.message,
				});
			}
		}

		// Publish done event
		await publishToRedis(conversationId, { type: "done" });

		// Check if compaction should be triggered
		const tokenBudget = getModelBudget(model);

		// Only check dropped messages for compaction (not entire history)
		if (
			droppedCount > 0 &&
			shouldCompact({ messages: droppedMessages, tokenBudget })
		) {
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
