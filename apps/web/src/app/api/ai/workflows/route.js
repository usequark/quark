import { WorkflowSchema } from "@techstream/quark-ai/workflow-schemas";
import { validateBody } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

const createWorkflowSchema = WorkflowSchema;

const runWorkflowSchema = z.object({
	workflowId: z.string().min(1).optional(),
	workflow: WorkflowSchema.optional(),
});

export async function GET(_request) {
	try {
		const session = await requireAuth();
		const workflows = await prisma.aiWorkflow.findMany({
			where: {
				OR: [{ userId: session.user.id }, { userId: null }],
			},
			orderBy: { updatedAt: "desc" },
		});
		return NextResponse.json({ data: workflows });
	} catch (error) {
		return handleError(error);
	}
}

export async function POST(request) {
	try {
		const session = await requireAuth();
		const data = await validateBody(request, createWorkflowSchema);

		const workflow = await prisma.aiWorkflow.create({
			data: {
				name: data.name,
				description: data.description || null,
				trigger: data.trigger || "manual",
				eventName: data.eventName || null,
				steps: data.steps,
				enabled: data.enabled ?? true,
				userId: session.user.id,
			},
		});

		return NextResponse.json({ data: workflow }, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
}

export async function PUT(request) {
	try {
		const session = await requireAuth();
		const body = await request.json();
		const id = z.string().min(1).parse(body.id);
		const data = createWorkflowSchema.parse(body);

		const existing = await prisma.aiWorkflow.findFirst({
			where: { id, userId: session.user.id },
		});
		if (!existing) {
			return NextResponse.json(
				{ error: "Workflow not found" },
				{ status: 404 },
			);
		}

		const workflow = await prisma.aiWorkflow.update({
			where: { id },
			data: {
				name: data.name,
				description: data.description || null,
				trigger: data.trigger || "manual",
				eventName: data.eventName || null,
				steps: data.steps,
				enabled: data.enabled ?? true,
			},
		});

		return NextResponse.json({ data: workflow });
	} catch (error) {
		return handleError(error);
	}
}

export async function DELETE(request) {
	try {
		const session = await requireAuth();
		const { searchParams } = new URL(request.url);
		const id = z.string().min(1).parse(searchParams.get("id"));

		const existing = await prisma.aiWorkflow.findFirst({
			where: { id, userId: session.user.id },
		});
		if (!existing) {
			return NextResponse.json(
				{ error: "Workflow not found" },
				{ status: 404 },
			);
		}

		await prisma.aiWorkflow.delete({ where: { id } });
		return NextResponse.json({ data: { id } });
	} catch (error) {
		return handleError(error);
	}
}

/**
 * Dry-run / execute a workflow definition (MVP: validates + records lastResult
 * without requiring the full worker tool runtime when tools aren't injected).
 */
export async function PATCH(request) {
	try {
		const session = await requireAuth();
		const data = await validateBody(request, runWorkflowSchema);

		let workflowDef = data.workflow;
		const workflowId = data.workflowId;

		if (workflowId && !workflowDef) {
			const stored = await prisma.aiWorkflow.findFirst({
				where: {
					id: workflowId,
					OR: [{ userId: session.user.id }, { userId: null }],
				},
			});
			if (!stored) {
				return NextResponse.json(
					{ error: "Workflow not found" },
					{ status: 404 },
				);
			}
			workflowDef = {
				name: stored.name,
				description: stored.description,
				trigger: stored.trigger,
				eventName: stored.eventName,
				steps: stored.steps,
				enabled: stored.enabled,
			};
		}

		if (!workflowDef) {
			return NextResponse.json(
				{ error: "workflow or workflowId is required" },
				{ status: 400 },
			);
		}

		const parsed = WorkflowSchema.parse(workflowDef);

		// MVP dry-run: validate structure and simulate step outcomes without
		// executing side-effecting tools in the web process.
		const results = parsed.steps.map((step) => ({
			stepId: step.id,
			status: step.type === "tool_call" ? "planned" : "completed",
			type: step.type,
			tool: step.tool,
			description: step.description,
		}));

		const lastResult = {
			workflow: parsed.name,
			mode: "dry-run",
			results,
			ranAt: new Date().toISOString(),
		};

		if (workflowId) {
			await prisma.aiWorkflow.update({
				where: { id: workflowId },
				data: {
					lastRunAt: new Date(),
					lastResult,
				},
			});
		}

		return NextResponse.json({ data: lastResult });
	} catch (error) {
		return handleError(error);
	}
}
