import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { complete } from "../lib/openrouter.js";

/**
 * Handles context extraction from conversation messages.
 * Analyzes messages and extracts structured context records.
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

		// Build a transcript for extraction
		const transcript = messages
			.map((m) => `${m.role}: ${m.content}`)
			.join("\n\n");

		// Call OpenRouter to extract structured context
		const extractionPrompt = `Extract key information from this conversation as structured context records.
Each record should have:
- key: a short identifier (snake_case)
- value: the extracted information
- category: one of: "client", "process", "preference", "tech_note", "billing"

Return ONLY a valid JSON array of objects with keys: key, value, category.
If nothing to extract, return an empty array.
No markdown, no explanation.

Conversation:
${transcript}`;

		const result = await complete({
			model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash",
			messages: [{ role: "user", content: extractionPrompt }],
			options: { temperature: 0.1, max_tokens: 2000 },
		});

		const content = result.choices?.[0]?.message?.content || "[]";
		let contexts;

		try {
			// Try direct JSON parse first (for clean responses)
			contexts = JSON.parse(content);
		} catch {
			// Fall back to extracting JSON from markdown code fences
			const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
			if (jsonMatch) {
				try {
					contexts = JSON.parse(jsonMatch[1].trim());
				} catch {
					contexts = null;
				}
			} else {
				contexts = null;
			}
		}

		if (!contexts) {
			logger.warn("Failed to parse extraction result", {
				conversationId,
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

		// Write extracted context to the Context model
		let extracted = 0;
		const saved = [];

		for (const ctx of contexts) {
			if (ctx.key && ctx.value && ctx.category) {
				try {
					const record = await prisma.context.upsert({
						where: {
							key_category: { key: ctx.key, category: ctx.category },
						},
						update: {
							value: ctx.value,
							source: "ai",
						},
						create: {
							key: ctx.key,
							value: ctx.value,
							category: ctx.category,
							source: "ai",
						},
					});
					saved.push(record);
					extracted++;
					logger.info("Context extracted", {
						key: ctx.key,
						category: ctx.category,
					});
				} catch (dbError) {
					logger.warn("Failed to save context record", {
						key: ctx.key,
						error: dbError.message,
					});
				}
			}
		}

		logger.info("Context extraction completed", {
			conversationId,
			extracted,
			total: contexts.length,
		});

		return { extracted, contexts: saved };
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
