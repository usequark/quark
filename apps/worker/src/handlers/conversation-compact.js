/**
 * Conversation Compaction Handler
 * Summarizes dropped (truncated) messages and persists the summary on the conversation.
 */

import { createLogger } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { JOB_NAMES } from "@techstream/quark-jobs";
import { summarizeConversation } from "../lib/summarize.js";

const _logger = createLogger("worker:compact");

/**
 * Handles conversation compaction after truncation.
 * Loads the oldest dropped messages, summarizes them, and updates the conversation.
 *
 * Job data expected:
 *   - conversationId: string
 *   - droppedCount: number
 *   - model: string (optional)
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleConversationCompact(bullJob, logger) {
	const { conversationId, droppedCount, model } = bullJob.data;

	if (!conversationId) {
		throw new AppError(
			"Conversation compaction requires a conversationId",
			400,
			"COMPACT_CONVERSATION_ID_REQUIRED",
		);
	}

	if (!droppedCount || droppedCount < 1) {
		throw new AppError(
			"Conversation compaction requires a positive droppedCount",
			400,
			"COMPACT_DROPPED_COUNT_REQUIRED",
		);
	}

	logger.info("Starting conversation compaction", {
		job: JOB_NAMES.AI_CONVERSATION_COMPACT,
		conversationId,
		droppedCount,
	});

	const conversation = await prisma.aiConversation.findUnique({
		where: { id: conversationId },
		include: {
			messages: {
				orderBy: { createdAt: "asc" },
				take: droppedCount,
			},
		},
	});

	if (!conversation || conversation.deletedAt) {
		throw new AppError("Conversation not found", 404, "CONVERSATION_NOT_FOUND");
	}

	const { summary, tokenCount } = await summarizeConversation(
		conversation.messages,
		model,
	);

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
			job: JOB_NAMES.AI_CONVERSATION_COMPACT,
			conversationId,
			summaryTokens: tokenCount,
		});
	} else {
		logger.warn("Compaction produced empty summary", {
			job: JOB_NAMES.AI_CONVERSATION_COMPACT,
			conversationId,
			messageCount: conversation.messages.length,
		});
	}

	return {
		conversationId,
		summaryLength: summary?.length ?? 0,
		summaryTokens: tokenCount,
	};
}
