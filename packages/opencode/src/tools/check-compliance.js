import { tool } from "@opencode-ai/plugin";
import { z } from "zod";

/** @type {import("@opencode-ai/plugin").ToolDefinition} */
export const checkCompliance = tool({
	description: "Check content for brand compliance issues",
	args: {
		content: z.string().describe("The content text to check"),
		brandGuidelines: z
			.string()
			.optional()
			.describe("Optional brand guidelines to check against"),
	},
	async execute(args, context) {
		// Stub implementation — always passes
		return JSON.stringify({
			passed: true,
			issues: [],
			score: 0.95,
			checkedAt: new Date().toISOString(),
		});
	},
});
