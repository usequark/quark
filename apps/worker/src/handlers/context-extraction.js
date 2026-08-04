import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { complete } from "../lib/openrouter.js";

/**
 * Handles context extraction from conversation messages.
 * Analyzes completed conversations and extracts structured business knowledge.
 *
 * Job data expected:
 *   - conversationId: string
 *   - sessionTitle: string (optional) — context for the extraction prompt
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleContextExtraction(bullJob, logger) {
	const { conversationId, sessionTitle } = bullJob.data;

	if (!conversationId) {
		throw new AppError(
			"Context extraction requires a conversationId",
			400,
			"CONTEXT_EXTRACTION_CONVERSATION_ID_REQUIRED",
		);
	}

	// Load conversation with messages
	const conversation = await prisma.aiConversation.findUnique({
		where: { id: conversationId },
		include: { messages: { orderBy: { createdAt: "asc" } } },
	});

	if (!conversation) {
		throw new AppError("Conversation not found", 404, "CONVERSATION_NOT_FOUND");
	}

	const messages = conversation.messages.map((m) => ({
		role: m.role.toLowerCase(),
		content: m.content,
	}));

	if (messages.length === 0) {
		logger.info("No messages found for extraction", {
			conversationId,
		});
		return { extracted: 0, contexts: [] };
	}

	logger.info("Starting context extraction", {
		conversationId,
		messageCount: messages.length,
		title: sessionTitle || "(untitled)",
	});

	try {
		// Build a transcript for extraction, truncating to avoid context overflow
		const MAX_TRANSCRIPT_CHARS = 60_000;
		let transcript = "";
		let truncated = false;
		for (let i = messages.length - 1; i >= 0; i--) {
			const m = messages[i];
			const entry = `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`;
			if (transcript.length + entry.length + 2 > MAX_TRANSCRIPT_CHARS) {
				truncated = true;
				break;
			}
			transcript = `${entry}\n\n${transcript}`;
		}
		if (truncated) {
			logger.info("Transcript truncated for extraction", {
				conversationId,
				totalMessages: messages.length,
				transcriptLength: transcript.length,
			});
		}

		// Build extraction prompt with structured guidance
		const extractionPrompt = `You are a business knowledge extraction system. Your job is to analyze the following conversation and extract any useful business knowledge that would help future conversations.

## What to extract

Look for information about:
1. **Client details** — preferences, requirements, configuration notes, contacts
2. **Billing rules** — pricing, invoice schedules, payment terms
3. **Processes** — how tasks should be done, approval workflows, best practices
4. **Technical notes** — system configurations, integration details, bugs, fixes
5. **Preferences** — communication style, priority handling, team preferences

## Rules

- Only extract INFORMATION, not opinions or speculation.
- Be concise. Each piece of context should be a single, factual statement.
- If nothing worth extracting was learned, return an empty array.
- Use categories: "client", "billing", "process", "preference", "tech_note"

## Output Format

Return a JSON array of objects:
\`\`\`json
[
  {
    "key": "client.client_name.topic",
    "value": "The factual statement to remember",
    "category": "client|billing|process|preference|tech_note"
  }
]
\`\`\`

## Conversation to Analyze

Title: ${sessionTitle || "Untitled conversation"}

${transcript}`;

		// Call OpenRouter to extract structured context
		const result = await complete({
			model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash",
			messages: [{ role: "user", content: extractionPrompt }],
			options: { temperature: 0.1, max_tokens: 2000 },
		});

		const fullText = result.choices?.[0]?.message?.content || "";
		let extractedEntries = [];

		// Find JSON array in the response (between ```json and ``` or raw)
		const jsonMatch = fullText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
		const jsonStr = jsonMatch ? jsonMatch[1] : fullText;

		try {
			const parsed = JSON.parse(jsonStr);
			if (Array.isArray(parsed)) {
				extractedEntries = parsed;
			}
		} catch {
			// Try to find a JSON array anywhere in the text
			try {
				const startIdx = fullText.indexOf("[");
				const endIdx = fullText.lastIndexOf("]");
				if (startIdx !== -1 && endIdx > startIdx) {
					const extracted = JSON.parse(fullText.slice(startIdx, endIdx + 1));
					if (Array.isArray(extracted)) {
						extractedEntries = extracted;
					}
				}
			} catch {
				logger.warn("Could not parse extraction output as JSON", {
					preview: fullText.slice(0, 500),
				});
			}
		}

		if (!Array.isArray(extractedEntries) || extractedEntries.length === 0) {
			return { extracted: 0, contexts: [] };
		}

		// Validate and store extracted entries
		const validCategories = [
			"client",
			"billing",
			"process",
			"preference",
			"tech_note",
		];
		let extracted = 0;
		const saved = [];

		for (const entry of extractedEntries) {
			if (!entry.key || !entry.value || !entry.category) {
				continue;
			}

			const category = validCategories.includes(entry.category)
				? entry.category
				: "process";

			try {
				const record = await prisma.context.upsert({
					where: {
						key_category: { key: entry.key, category },
					},
					update: {
						value: entry.value,
						source: "ai",
					},
					create: {
						key: entry.key,
						value: entry.value,
						category,
						source: "ai",
					},
				});
				saved.push(record);
				extracted++;
				logger.info("Context extracted", {
					key: entry.key,
					category,
				});
			} catch (dbError) {
				logger.warn("Failed to save context record", {
					key: entry.key,
					error: dbError.message,
				});
			}
		}

		logger.info("Context extraction completed", {
			conversationId,
			extracted,
			total: extractedEntries.length,
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
