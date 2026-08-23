import { validateBody, withCsrfProtection } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

const updateConversationSchema = z.object({
	title: z.string().max(200).optional(),
});

export async function GET(_request, { params }) {
	try {
		const session = await requireRole(["admin", "lead_dev", "editor", "viewer"]);
		const { id } = await params;

		const conversation = await prisma.aiConversation.findUnique({
			where: { id },
			include: {
				messages: { orderBy: { createdAt: "asc" } },
				user: { select: { id: true, name: true, email: true, image: true } },
			},
		});
		if (!conversation || conversation.deletedAt) {
			return NextResponse.json(
				{ message: "Conversation not found" },
				{ status: 404 },
			);
		}

		const userRole = session.user?.role;
		if (
			userRole !== "admin" &&
			userRole !== "lead_dev" &&
			conversation.userId !== session.user?.id
		) {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		return NextResponse.json(conversation);
	} catch (error) {
		return handleError(error);
	}
}

export const PATCH = withCsrfProtection(async (request, { params }) => {
	try {
		const session = await requireRole(["admin", "lead_dev"]);
		const { id } = await params;

		const existing = await prisma.aiConversation.findUnique({ where: { id } });
		if (!existing || existing.deletedAt) {
			return NextResponse.json(
				{ message: "Conversation not found" },
				{ status: 404 },
			);
		}
		if (
			session.user?.role !== "admin" &&
			session.user?.role !== "lead_dev" &&
			existing.userId !== session.user?.id
		) {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		const data = await validateBody(request, updateConversationSchema);
		const conversation = await prisma.aiConversation.update({
			where: { id },
			data,
		});
		return NextResponse.json(conversation);
	} catch (error) {
		return handleError(error);
	}
});

export const DELETE = withCsrfProtection(async (_request, { params }) => {
	try {
		const session = await requireRole(["admin", "lead_dev"]);
		const { id } = await params;

		const existing = await prisma.aiConversation.findUnique({ where: { id } });
		if (!existing || existing.deletedAt) {
			return NextResponse.json(
				{ message: "Conversation not found" },
				{ status: 404 },
			);
		}
		if (
			session.user?.role !== "admin" &&
			session.user?.role !== "lead_dev" &&
			existing.userId !== session.user?.id
		) {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		await prisma.aiConversation.update({
			where: { id },
			data: { deletedAt: new Date() },
		});
		return NextResponse.json({ success: true });
	} catch (error) {
		return handleError(error);
	}
});
