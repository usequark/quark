import { validateBody } from "@techstream/quark-core";
import { ensureCrmConfig, updateCrmConfig } from "@techstream/quark-crm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../../../error-handler";

const stageSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	color: z.string().min(1),
	probability: z.number().min(0).max(100),
	next: z.array(z.string()),
});

const fieldSchema = z
	.object({
		key: z.string().min(1),
		type: z.string().min(1),
	})
	.passthrough();

const updateConfigSchema = z.object({
	entityLabel: z.string().min(1).optional(),
	entityPluralLabel: z.string().min(1).optional(),
	containerLabel: z.string().min(1).optional(),
	containerPluralLabel: z.string().min(1).optional(),
	actorLabel: z.string().min(1).optional(),
	actorPluralLabel: z.string().min(1).optional(),
	pipelineStages: z.array(stageSchema).min(1).optional(),
	currency: z.string().min(1).optional(),
	locale: z.string().min(1).optional(),
	defaultPageSize: z.number().int().positive().optional(),
	fields: z
		.object({
			entity: z.array(fieldSchema),
			actor: z.array(fieldSchema),
			container: z.array(fieldSchema),
		})
		.optional(),
});

export async function GET(_request) {
	try {
		await requireRole(["admin", "editor"]);
		const config = await ensureCrmConfig();
		return NextResponse.json({ data: config });
	} catch (error) {
		return handleError(error);
	}
}

export async function PUT(request) {
	try {
		await requireRole(["admin"]);
		const data = await validateBody(request, updateConfigSchema);
		const config = await updateCrmConfig(data);
		return NextResponse.json({ data: config });
	} catch (error) {
		return handleError(error);
	}
}
