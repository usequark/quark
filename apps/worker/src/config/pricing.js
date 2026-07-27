/**
 * Default model pricing (USD per 1M tokens).
 *
 * Override or extend at runtime via OPENROUTER_PRICING_OVERRIDE (JSON string).
 * Example:
 *   OPENROUTER_PRICING_OVERRIDE='{"openai/gpt-4o":{"input":2.0,"output":8.0}}'
 *
 * Override entries are shallow-merged on top of these defaults.
 */

/** @type {Record<string, { input: number, output: number }>} */
export const DEFAULT_PRICING = {
	"deepseek/deepseek-v4-flash": { input: 0.09, output: 0.18 },
	"anthropic/claude-3.5-sonnet": { input: 3, output: 15 },
	"anthropic/claude-3-opus": { input: 15, output: 75 },
	"anthropic/claude-4-sonnet": { input: 15, output: 75 },
	"openai/gpt-4o": { input: 2.5, output: 10 },
	"openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
	"google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

/**
 * Resolve pricing table: defaults merged with optional OPENROUTER_PRICING_OVERRIDE.
 * @returns {Record<string, { input: number, output: number }>}
 */
export function getPricing() {
	const pricing = { ...DEFAULT_PRICING };
	const override = process.env.OPENROUTER_PRICING_OVERRIDE;

	if (!override) {
		return pricing;
	}

	try {
		const parsed = JSON.parse(override);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return { ...pricing, ...parsed };
		}
	} catch {
		// Invalid JSON — fall back to defaults
	}

	return pricing;
}

export default getPricing;
