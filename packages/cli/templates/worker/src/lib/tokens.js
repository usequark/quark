import { createLogger } from "@techstream/quark-core";

const _logger = createLogger("worker:tokens");

// Model configurations
const MODELS = {
	"deepseek/deepseek-v4-flash": { contextWindow: 1_000_000 },
	"deepseek/deepseek-chat": { contextWindow: 64_000 },
	"anthropic/claude-3.5-sonnet": { contextWindow: 200_000 },
	"openai/gpt-4o": { contextWindow: 128_000 },
};

const DEFAULT_CONTEXT_WINDOW = 128_000;
const CHARS_PER_TOKEN = 4;
const OVERHEAD_PER_MESSAGE = 14; // ~4 for role framing + ~10 for tool call structure

/**
 * Estimate token count for a string
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
	if (!text) return 0;
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate total tokens for an array of messages
 * @param {Array<{role: string, content?: string, tool_calls?: Array, tool_results?: Array}>} messages
 * @returns {number}
 */
export function estimateMessageTokens(messages) {
	if (!messages || messages.length === 0) return 0;

	let total = 0;
	for (const msg of messages) {
		total += OVERHEAD_PER_MESSAGE;
		if (msg.content) total += estimateTokens(msg.content);
		if (msg.tool_calls) {
			for (const tc of msg.tool_calls) {
				total += estimateTokens(JSON.stringify(tc));
			}
		}
		if (msg.tool_results) {
			for (const tr of msg.tool_results) {
				total += estimateTokens(JSON.stringify(tr));
			}
		}
	}
	return total;
}

/**
 * Get usable token budget for a model
 * @param {string} model
 * @param {object} options
 * @returns {number}
 */
export function getModelBudget(model, options = {}) {
	const {
		responseReserved = 8_000,
		toolsReserved = 2_500,
		systemReserved = 500,
	} = options;
	const config = MODELS[model] || { contextWindow: DEFAULT_CONTEXT_WINDOW };
	const usable =
		config.contextWindow - responseReserved - toolsReserved - systemReserved;
	return Math.floor(usable * 0.8); // 80% safety margin
}
