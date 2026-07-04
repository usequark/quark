import { createLogger } from "@techstream/quark-core";
import { complete } from "./openrouter.js";

const logger = createLogger("worker:summarize");

const SUMMARIZATION_PROMPT = `Summarize the following conversation into a concise context block. 
Preserve:
- Key decisions made
- Entity names (contacts, companies, deals, tasks)
- User preferences and instructions
- Unresolved topics or questions
- Important facts or data points

Return ONLY the summary text. Do not add any preamble or explanation.`;

/**
 * Summarize older messages into a condensed context block
 * @param {Array} messages - Messages to summarize (the ones being compacted)
 * @param {string} model - Model ID to use for summarization
 * @returns {{ summary: string, tokenCount: number }}
 */
export async function summarizeConversation(
	messages,
	model = "deepseek/deepseek-v4-flash",
) {
	if (!messages || messages.length === 0) {
		return { summary: "", tokenCount: 0 };
	}

	// Format messages for summarization
	const conversationText = messages
		.map((m) => {
			const role = m.role === "tool" ? "tool_result" : m.role;
			return `[${role}]: ${m.content || JSON.stringify(m.tool_results || m.tool_calls || "")}`;
		})
		.join("\n\n");

	logger.info("Summarizing conversation", {
		messageCount: messages.length,
		conversationLength: conversationText.length,
	});

	try {
		const result = await complete({
			model,
			messages: [
				{ role: "system", content: SUMMARIZATION_PROMPT },
				{ role: "user", content: conversationText },
			],
			options: { max_tokens: 2_000 },
		});

		const summary = result.choices?.[0]?.message?.content || "";
		const tokenCount = Math.ceil(summary.length / 4); // Estimate

		logger.info("Generated summary", {
			summaryLength: summary.length,
			estimatedTokens: tokenCount,
		});

		return { summary, tokenCount };
	} catch (error) {
		logger.error("Failed to summarize conversation", {
			error: error.message,
		});
		// Return empty summary — truncation still works by dropping messages
		return { summary: "", tokenCount: 0 };
	}
}
