import { createLogger } from "@techstream/quark-core";
import {
	estimateMessageTokens,
	estimateTokens,
	getModelBudget,
} from "./tokens.js";

const logger = createLogger("worker:truncation");

/**
 * Build prompt messages with truncation
 * @param {object} options
 * @param {Array} options.messages - Raw DB messages
 * @param {string} options.summary - Optional summary of older messages
 * @param {number} options.summaryTokens - Estimated token count of summary
 * @param {string} options.model - Model ID
 * @param {string} options.systemPrompt - System prompt
 * @returns {{ messages: Array, wasTruncated: boolean, droppedCount: number, estimatedTokens: number }}
 */
export function buildPromptMessages({
	messages,
	summary,
	summaryTokens = 0,
	model,
	systemPrompt,
}) {
	const budget = getModelBudget(model);
	const systemTokens = estimateTokens(systemPrompt) + 4; // +4 for role framing
	const reservedForSummary = summary ? summaryTokens : 0;
	const availableForMessages = budget - systemTokens - reservedForSummary;

	// Build system message
	const systemMessage = { role: "system", content: systemPrompt };

	// If no messages, return just system
	if (!messages || messages.length === 0) {
		return {
			messages: [systemMessage],
			wasTruncated: false,
			droppedCount: 0,
			estimatedTokens: systemTokens,
		};
	}

	// If summary exists, prepend it as a context block
	let summaryMessage = null;
	if (summary) {
		summaryMessage = {
			role: "system",
			content: `[Context from earlier conversation]\n${summary}`,
		};
	}

	// Walk backwards from most recent, accumulating tokens
	const retained = [];
	let tokensUsed = 0;
	let droppedCount = 0;

	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		const msgTokens = estimateMessageTokens([msg]);

		if (tokensUsed + msgTokens > availableForMessages) {
			// Can't fit this message - drop it (and all older ones)
			droppedCount = i + 1;
			break;
		}

		retained.unshift(msg);
		tokensUsed += msgTokens;
	}

	// Build final message array
	const promptMessages = [systemMessage];
	if (summaryMessage) {
		promptMessages.push(summaryMessage);
	}
	promptMessages.push(...retained);

	const totalTokens = systemTokens + reservedForSummary + tokensUsed;

	logger.info("Built prompt messages", {
		originalCount: messages.length,
		retainedCount: retained.length,
		droppedCount,
		wasTruncated: droppedCount > 0,
		estimatedTokens: totalTokens,
		budget,
	});

	return {
		messages: promptMessages,
		wasTruncated: droppedCount > 0,
		droppedCount,
		estimatedTokens: totalTokens,
	};
}

/**
 * Check if compaction should be triggered
 * @param {object} options
 * @param {Array} options.messages - All messages
 * @param {number} options.tokenBudget - Token budget
 * @param {number} options.threshold - Compaction threshold (default 0.75)
 * @returns {boolean}
 */
export function shouldCompact({ messages, tokenBudget, threshold = 0.75 }) {
	const estimatedTokens = estimateMessageTokens(messages);
	return estimatedTokens > tokenBudget * threshold;
}
