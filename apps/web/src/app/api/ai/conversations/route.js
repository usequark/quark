import { parsePaginationQuery, validateBody } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

const createConversationSchema = z.object({
	title: z.string().max(200).optional().default("New Conversation"),
	messages: z
		.array(
			z.object({
				role: z.enum(["user", "assistant", "system"]),
				content: z.string(),
			}),
		)
		.optional(),
});

export async function GET(request) {
	try {
		const session = await requireRole([
			"admin",
			"lead_dev",
			"editor",
			"viewer",
		]);
		const { searchParams } = new URL(request.url);
		const { skip, take, meta } = parsePaginationQuery(searchParams);

		const where = { deletedAt: null };

		// Non-admin users only see their own conversations
		const userRole = session.user?.role;
		if (userRole !== "admin" && userRole !== "lead_dev") {
			where.userId = session.user?.id;
		}

		const [conversations, total] = await Promise.all([
			prisma.aiConversation.findMany({
				where,
				orderBy: { updatedAt: "desc" },
				skip,
				take,
				include: {
					user: {
						select: { id: true, name: true, email: true, image: true },
					},
					_count: { select: { messages: true } },
				},
			}),
			prisma.aiConversation.count({ where }),
		]);

		return NextResponse.json({
			data: conversations,
			pagination: meta(total),
		});
	} catch (error) {
		return handleError(error);
	}
}

export async function POST(request) {
	try {
		const session = await requireRole(["admin", "lead_dev"]);
		const data = await validateBody(request, createConversationSchema);

		const conversation = await prisma.aiConversation.create({
			data: {
				title: data.title,
				userId: session.user?.id,
				messages: data.messages?.length
					? {
							create: data.messages.map((m) => ({
								role: m.role,
								content: m.content,
							})),
						}
					: undefined,
			},
			include: {
				messages: { orderBy: { createdAt: "asc" } },
				user: {
					select: { id: true, name: true, email: true, image: true },
				},
			},
		});

		return NextResponse.json(conversation, { status: 201 });
	} catch (error) {
		return handleError(error);
	}
}
