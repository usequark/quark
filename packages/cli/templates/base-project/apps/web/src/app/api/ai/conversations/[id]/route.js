import { validateBody } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "../../../error-handler";
import {
	requireAuth,
	requireConversationAccess,
} from "../../_lib/requireConversationAccess";

const updateConversationSchema = z.object({
	title: z.string().min(1).max(200),
});

export async function GET(_request, { params }) {
	try {
		const session = await requireAuth();
		const { id } = await params;
		const conversation = await requireConversationAccess(id, session);
		return NextResponse.json(conversation);
	} catch (error) {
		return handleError(error);
	}
}

export async function PATCH(request, { params }) {
	try {
		const session = await requireAuth();
		const { id } = await params;
		await requireConversationAccess(id, session);

		const data = await validateBody(request, updateConversationSchema);

		const conversation = await prisma.aiConversation.update({
			where: { id },
			data: { title: data.title },
			include: {
				messages: { orderBy: { createdAt: "asc" } },
				user: {
					select: { id: true, name: true, email: true, image: true },
				},
			},
		});

		return NextResponse.json(conversation);
	} catch (error) {
		return handleError(error);
	}
}

export async function DELETE(_request, { params }) {
	try {
		const session = await requireAuth();
		const { id } = await params;
		await requireConversationAccess(id, session);

		// Soft delete
		await prisma.aiConversation.update({
			where: { id },
			data: { deletedAt: new Date() },
		});

		// Create audit log
		await prisma.auditLog.create({
			data: {
				userId: session.user?.id,
				action: "DELETE",
				entity: "AiConversation",
				entityId: id,
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		return handleError(error);
	}
}
