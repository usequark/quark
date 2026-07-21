import { createLogger } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";
import { estimateMessageTokens } from "./tokens.js";

const logger = createLogger("openrouter");

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Complete a chat with OpenRouter.
 * @param {Object} options
 * @param {string} options.model - Model ID (e.g., "anthropic/claude-3.5-sonnet")
 * @param {Array} options.messages - Chat messages
 * @param {Object} [options.options] - Additional options
 * @returns {Promise<Object>}
 */
export async function complete({ model, messages, options = {} }) {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw new AppError(
			"OPENROUTER_API_KEY is not configured",
			500,
			"OPENROUTER_NOT_CONFIGURED",
		);
	}

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const response = await fetch(OPENROUTER_API_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
					"HTTP-Referer": process.env.APP_URL || "https://quark.dev",
					"X-Title": "Quark AI",
				},
				body: JSON.stringify({
					model,
					messages,
					...options,
				}),
			});

			if (response.status === 429) {
				// Rate limited - retry after delay
				const retryAfter = response.headers.get("retry-after");
				const delay = retryAfter
					? Number.parseInt(retryAfter, 10) * 1000
					: RETRY_DELAY_MS * attempt;
				logger.warn("Rate limited by OpenRouter", {
					attempt,
					retryAfter: delay,
				});
				await sleep(delay);
				continue;
			}

			if (response.status >= 500) {
				// Server error - retry
				logger.warn("OpenRouter server error", {
					attempt,
					status: response.status,
				});
				await sleep(RETRY_DELAY_MS * attempt);
				continue;
			}

			if (!response.ok) {
				const errorBody = await response.text();
				throw new AppError(
					`OpenRouter API error: ${response.status} ${errorBody}`,
					response.status,
					"OPENROUTER_API_ERROR",
				);
			}

			const data = await response.json();
			return data;
		} catch (error) {
			if (error instanceof AppError) throw error;
			if (attempt === MAX_RETRIES) {
				throw new AppError(
					`OpenRouter failed after ${MAX_RETRIES} attempts: ${error.message}`,
					502,
					"OPENROUTER_FAILED",
				);
			}
			logger.warn("OpenRouter request failed, retrying", {
				attempt,
				error: error.message,
			});
			await sleep(RETRY_DELAY_MS * attempt);
		}
	}
}

/**
 * Complete a chat with OpenRouter, supporting tool calling.
 * Implements a multi-turn tool calling loop (max 20 rounds).
 * @param {Object} options
 * @param {string} options.model
 * @param {Array} options.messages
 * @param {Array} [options.tools]
 * @param {Function} [options.onToolCall]
 * @param {number} [options.budget] - Token budget for compressing tool results
 * @param {Object} [options.options]
 * @returns {Promise<Object>}
 */
export async function completeWithTools({
	model,
	messages,
	tools,
	onToolCall,
	budget,
	options = {},
}) {
	const MAX_ROUNDS = 20;
	const MAX_TOOL_CONTENT_LENGTH = 500;
	const currentMessages = [...messages];
	let totalCost = 0;

	for (let round = 0; round < MAX_ROUNDS; round++) {
		const result = await complete({
			model,
			messages: currentMessages,
			options: {
				...options,
				...(tools && { tools }),
			},
		});

		const choice = result.choices?.[0];
		if (!choice) {
			throw new AppError(
				"No response from OpenRouter",
				502,
				"OPENROUTER_NO_RESPONSE",
			);
		}

		totalCost += estimateCost(result.usage || {});

		// Log token usage for monitoring
		if (result.usage) {
			logger.info("OpenRouter token usage", {
				prompt_tokens: result.usage.prompt_tokens,
				completion_tokens: result.usage.completion_tokens,
				total_tokens: result.usage.total_tokens,
				round,
			});
		}

		// Check for tool calls
		if (choice.message?.tool_calls?.length > 0) {
			// Add assistant message with tool calls
			currentMessages.push(choice.message);

			// Execute each tool call
			for (const toolCall of choice.message.tool_calls) {
				const toolName = toolCall.function?.name;
				const toolInput = JSON.parse(toolCall.function?.arguments || "{}");

				try {
					const toolResult = onToolCall
						? await onToolCall(toolName, toolInput)
						: { error: "No tool handler" };

					let toolContent = JSON.stringify(toolResult);

					// Compress large tool results if budget is set
					if (budget && toolContent.length > MAX_TOOL_CONTENT_LENGTH) {
						toolContent = `${toolContent.slice(0, MAX_TOOL_CONTENT_LENGTH)}...[truncated]`;
						logger.info("Compressed tool result", {
							tool: toolName,
							originalLength: JSON.stringify(toolResult).length,
							compressedLength: toolContent.length,
						});
					}

					currentMessages.push({
						role: "tool",
						tool_call_id: toolCall.id,
						content: toolContent,
					});
				} catch (error) {
					currentMessages.push({
						role: "tool",
						tool_call_id: toolCall.id,
						content: JSON.stringify({ error: error.message }),
					});
				}
			}

			// Check if we're over budget during the tool loop
			if (budget) {
				const currentTokens = estimateMessageTokens(currentMessages);
				if (currentTokens > budget) {
					logger.warn("Token budget exceeded during tool loop", {
						currentTokens,
						budget,
						round,
					});
					// Truncate the oldest non-recent tool results to stay within budget
					for (let i = 1; i < currentMessages.length - 5; i++) {
						const msg = currentMessages[i];
						if (
							msg.role === "tool" &&
							msg.content &&
							msg.content.length > 500
						) {
							msg.content = `${msg.content.slice(0, 500)}...[truncated by budget]`;
						}
					}
				}
			}

			// Continue the loop for the next round
			continue;
		}

		// No tool calls - return the final response
		return {
			...result,
			totalCost,
			rounds: round + 1,
		};
	}

	throw new AppError(
		`Tool calling loop exceeded ${MAX_ROUNDS} rounds`,
		500,
		"TOOL_LOOP_EXCEEDED",
	);
}

/**
 * Estimate the cost of a completion based on token usage.
 * @param {Object} usage - { prompt_tokens, completion_tokens, total_tokens }
 * @param {string} [model] - Model ID for pricing lookup
 * @returns {number} Estimated cost in dollars
 */
export function estimateCost(usage, model = "deepseek/deepseek-v4-flash") {
	if (!usage) return 0;

	// Pricing per 1M tokens (simplified)
	const pricing = {
		"deepseek/deepseek-v4-flash": { input: 0.09, output: 0.18 },
		"anthropic/claude-3.5-sonnet": { input: 3, output: 15 },
		"anthropic/claude-3-opus": { input: 15, output: 75 },
		"openai/gpt-4o": { input: 2.5, output: 10 },
		"openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
		"google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
	};

	const rates = pricing[model] || pricing["deepseek/deepseek-v4-flash"];
	const inputCost = ((usage.prompt_tokens || 0) / 1_000_000) * rates.input;
	const outputCost =
		((usage.completion_tokens || 0) / 1_000_000) * rates.output;

	return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
