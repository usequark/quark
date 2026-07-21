import { applyRateLimit } from "@techstream/quark-config";
import { createQueue, validateBody } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { handleError } from "../../error-handler";

const chatSchema = z.object({
	conversationId: z.string().min(1, "conversationId is required"),
	message: z.string().min(1, "Message cannot be empty").max(10000),
});

export async function POST(request) {
	try {
		const session = await requireAuth();

		// Apply rate limiting: 10 requests per minute per user
		const rateLimitResponse = await applyRateLimit(session.user.id, {
			limit: 10,
			windowMs: 60000,
			route: "chat",
		});
		if (rateLimitResponse) {
			return rateLimitResponse;
		}

		const data = await validateBody(request, chatSchema);

		// Save user message
		const userMessage = await prisma.aiMessage.create({
			data: {
				conversationId: data.conversationId,
				role: "user",
				content: data.message,
			},
		});

		// Auto-rename conversation from first message
		const conversation = await prisma.aiConversation.findUnique({
			where: { id: data.conversationId },
			include: { _count: { select: { messages: true } } },
		});

		if (
			conversation &&
			conversation._count.messages === 1 &&
			conversation.title === "New Conversation"
		) {
			const title =
				data.message.slice(0, 100) + (data.message.length > 100 ? "..." : "");
			await prisma.aiConversation.update({
				where: { id: data.conversationId },
				data: { title },
			});
		}

		const queue = createQueue("ai-queue");
		const job = await queue.add("ai-agent-task", {
			conversationId: data.conversationId,
			userId: session.user?.id,
			message: data.message,
		});

		return NextResponse.json(
			{
				jobId: job.id,
				conversationId: data.conversationId,
				messageId: userMessage.id,
			},
			{ status: 201 },
		);
	} catch (error) {
		return handleError(error);
	}
}
