import { z } from "zod";

// ── Schema ──────────────────────────────────────────────────────────────────

export const WorkflowStepSchema = z.object({
	id: z.string(),
	type: z.enum(["tool_call", "condition", "approval", "delay"]),
	tool: z.string().optional(),
	params: z.any().optional(),
	condition: z.string().optional(),
	// biome-ignore lint/suspicious/noThenProperty: workflow conditional branches
	then: z.array(z.lazy(() => WorkflowStepSchema)).optional(),
	else: z.array(z.lazy(() => WorkflowStepSchema)).optional(),
	permission: z.enum(["auto", "confirm", "disabled"]).optional(),
	delayMs: z.number().optional(),
	description: z.string().optional(),
});

export const WorkflowSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1),
	description: z.string().optional(),
	trigger: z.enum(["manual", "event"]).default("manual"),
	eventName: z.string().optional(),
	steps: z.array(WorkflowStepSchema),
	enabled: z.boolean().default(true),
});
