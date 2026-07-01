import { tool } from "@opencode-ai/plugin";
import { z } from "zod";

/** @type {import("@opencode-ai/plugin").ToolDefinition} */
export const publishToCms = tool({
	description: "Publish a content draft to the Techstream CMS",
	args: {
		contentId: z.string().describe("Unique identifier for the content"),
		title: z.string().describe("Title of the content"),
		body: z.string().describe("Body/content text"),
		scheduledDate: z
			.string()
			.optional()
			.describe("Optional scheduled publish date (ISO 8601)"),
	},
	async execute(args, context) {
		const { contentId, title, scheduledDate } = args;
		const dateInfo = scheduledDate
			? ` scheduled for ${scheduledDate}`
			: " for immediate publication";
		return JSON.stringify({
			success: true,
			message: `Published "${title}" (${contentId})${dateInfo}`,
			contentId,
			publishedAt: scheduledDate || new Date().toISOString(),
		});
	},
});
