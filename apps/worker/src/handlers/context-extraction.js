import { createLogger } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { complete } from "../lib/openrouter.js";

const logger = createLogger("context-extraction");

/**
 * Handles context extraction from conversation messages.
 * Analyzes messages and extracts business context records.
 *
 * Job data expected:
 *   - conversationId: string
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleContextExtraction(bullJob, logger) {
	const { conversationId } = bullJob.data;

	if (!conversationId) {
		throw new AppError(
			"Context extraction requires a conversationId",
			400,
			"CONTEXT_EXTRACTION_CONVERSATION_ID_REQUIRED",
		);
	}

	logger.info("Starting context extraction", {
		conversationId,
	});

	try {
		// Load messages from conversation
		const messages = await prisma.aiMessage.findMany({
			where: { conversationId },
			orderBy: { createdAt: "asc" },
		});

		if (messages.length === 0) {
			logger.info("No messages found for extraction", {
				conversationId,
			});
			return { extracted: 0, contexts: [] };
		}

		// Build extraction prompt
		const messageText = messages
			.map((m) => `${m.role}: ${m.content}`)
			.join("\n");

		const extractionPrompt = `Analyze the following conversation and extract business context records. 
For each piece of business context found, return a JSON array of objects with:
- key: a descriptive key (e.g., "client.acme_corp.industry")
- value: the context value
- category: one of "billing", "client", "task", "tech_note", "process", "preference"
- source: "learned"

Return ONLY the JSON array, no other text.

Conversation:
${messageText}`;

		const result = await complete({
			model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
			messages: [
				{
					role: "system",
					content:
						"You are a business context extraction assistant. Extract relevant business information from conversations and return structured data.",
				},
				{ role: "user", content: extractionPrompt },
			],
		});

		const content = result.choices?.[0]?.message?.content || "[]";

		// Parse extracted contexts
		let contexts;
		try {
			// Try to extract JSON from the response (might be wrapped in markdown)
			const jsonMatch = content.match(/\[[\s\S]*\]/);
			contexts = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
		} catch {
			logger.warn("Failed to parse extraction result", {
				conversationId,
				content,
			});
			return {
				extracted: 0,
				contexts: [],
				error: "Failed to parse extraction result",
			};
		}

		if (!Array.isArray(contexts) || contexts.length === 0) {
			return { extracted: 0, contexts: [] };
		}

		// Upsert business context records (placeholder — in production, use a BusinessContext model)
		let extracted = 0;
		for (const ctx of contexts) {
			if (ctx.key && ctx.value && ctx.category) {
				logger.info("Extracted context", {
					key: ctx.key,
					category: ctx.category,
					source: ctx.source || "learned",
				});
				extracted++;
			}
		}

		logger.info("Context extraction completed", {
			conversationId,
			extracted,
			total: contexts.length,
		});

		return { extracted, contexts };
	} catch (error) {
		logger.error("Context extraction failed", {
			conversationId,
			error: error.message,
		});
		throw new AppError(
			`Context extraction failed: ${error.message}`,
			502,
			"CONTEXT_EXTRACTION_FAILED",
		);
	}
}
