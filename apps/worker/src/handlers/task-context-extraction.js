/**
 * Task Context Extraction Handler
 *
 * Scans recently created/modified tasks and extracts business knowledge
 * from their descriptions and comments. Stores learnings in BusinessContext.
 *
 * Designed to run as a scheduled job (hourly) or triggered after task creation.
 */

import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { complete } from "../lib/openrouter.js";

/**
 * Handles a task context extraction job.
 * Queries tasks from the last N minutes and extracts useful context.
 *
 * Job data expected:
 *   - sinceMinutes: number — look back window (default: 60)
 *
 * @param {import("bullmq").Job} bullJob
 * @param {Object} logger
 * @returns {Promise<Object>}
 */
export async function handleTaskContextExtraction(bullJob, logger) {
	const sinceMinutes = bullJob.data?.sinceMinutes || 60;
	const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

	logger.info("Starting task context extraction", {
		sinceMinutes,
		since: since.toISOString(),
	});

	try {
		// Query tasks created or updated in the window with descriptions or comments
		const tasks = await prisma.task.findMany({
			where: {
				OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }],
				description: { not: null },
			},
			select: {
				id: true,
				title: true,
				description: true,
				status: true,
				priority: true,
				clientId: true,
				client: { select: { name: true } },
				assignee: { select: { name: true } },
				createdAt: true,
				comments: {
					select: {
						content: true,
						author: { select: { name: true } },
						createdAt: true,
					},
					orderBy: { createdAt: "asc" },
					take: 10,
				},
			},
			orderBy: { createdAt: "desc" },
			take: 20,
		});

		if (tasks.length === 0) {
			logger.info("No recent tasks with descriptions found");
			return { scanned: 0, extracted: 0 };
		}

		logger.info(`Found ${tasks.length} recent tasks with descriptions`);

		// Build extraction prompt
		let taskBlock = "";
		for (const task of tasks) {
			taskBlock += `Task: ${task.title}\n`;
			taskBlock += `Client: ${task.client?.name || "Unknown"}\n`;
			taskBlock += `Status: ${task.status} | Priority: ${task.priority}\n`;
			taskBlock += `Assignee: ${task.assignee?.name || "Unassigned"}\n`;
			taskBlock += `Description: ${task.description || "(none)"}\n`;
			if (task.comments.length > 0) {
				taskBlock += "Comments:\n";
				for (const comment of task.comments) {
					taskBlock += `  - ${comment.author?.name || "Unknown"}: ${comment.content.slice(0, 200)}\n`;
				}
			}
			taskBlock += "\n";
		}

		const extractionPrompt = `You are a business knowledge extraction system. Analyze the following tasks and extract any useful business knowledge.

## What to extract

Look for information about:
1. **Client details** — preferences, requirements, configuration notes
2. **Technical notes** — system configurations, integration details, bugs, fixes
3. **Processes** — how tasks should be done, best practices
4. **Billing rules** — pricing, invoice schedules (if mentioned)

## Rules

- Only extract INFORMATION, not opinions or speculation.
- Be concise. Each piece of context should be a single, factual statement.
- If nothing worth extracting was learned, return an empty array.
- Use categories: "client", "tech_note", "process", "billing"

## Output Format

Return a JSON array of objects:
\`\`\`json
[
  {
    "key": "client.client_name.topic",
    "value": "The factual statement to remember",
    "category": "client|tech_note|process|billing"
  }
]
\`\`\`

## Tasks to Analyze

${taskBlock}
`;

		const result = await complete({ prompt: extractionPrompt });
		const fullText = result.content;

		let extractedEntries = [];
		const jsonMatch = fullText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
		const jsonStr = jsonMatch ? jsonMatch[1] : fullText;

		try {
			const parsed = JSON.parse(jsonStr);
			if (Array.isArray(parsed)) {
				extractedEntries = parsed;
			}
		} catch {
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
				logger.warn("Could not parse task extraction output as JSON", {
					preview: fullText.slice(0, 500),
				});
			}
		}

		// Validate and store
		let stored = 0;
		let skipped = 0;

		for (const entry of extractedEntries) {
			if (!entry.key || !entry.value || !entry.category) {
				skipped++;
				continue;
			}

			const validCategories = ["client", "tech_note", "process", "billing"];
			if (!validCategories.includes(entry.category)) {
				entry.category = "process";
			}

			try {
				await prisma.businessContext.upsert({
					where: {
						key_category: {
							key: entry.key,
							category: entry.category,
						},
					},
					update: {
						value: entry.value,
						// NOTE: source is NOT updated — preserves original "seed" tag
					},
					create: {
						key: entry.key,
						value: entry.value,
						category: entry.category,
						source: "learned",
					},
				});
				stored++;
			} catch (error) {
				logger.warn("Failed to store task extraction entry", {
					key: entry.key,
					error: error.message,
				});
				skipped++;
			}
		}

		logger.info("Task context extraction completed", {
			tasksScanned: tasks.length,
			extracted: extractedEntries.length,
			stored,
			skipped,
		});

		return {
			tasksScanned: tasks.length,
			extracted: extractedEntries.length,
			stored,
			skipped,
		};
	} catch (error) {
		logger.error("Task context extraction failed", {
			error: error.message,
			errorStack: error.stack?.slice(0, 500),
		});
		if (error instanceof AppError) throw error;
		throw new AppError(
			`Task context extraction failed: ${error.message}`,
			502,
			"TASK_EXTRACTION_FAILED",
		);
	}
}
