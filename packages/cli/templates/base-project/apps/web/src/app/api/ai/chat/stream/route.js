import { prisma } from "@techstream/quark-db";
import { NextResponse } from "next/server";
import { handleError } from "../../error-handler";
import {
	requireAuth,
	requireConversationAccess,
} from "../_lib/requireConversationAccess";

export async function GET(request) {
	try {
		const session = await requireAuth();
		const { searchParams } = new URL(request.url);
		const conversationId = searchParams.get("conversationId");

		if (!conversationId) {
			return NextResponse.json(
				{ error: "conversationId is required" },
				{ status: 400 },
			);
		}

		await requireConversationAccess(conversationId, session);

		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				let timeoutId;
				let messageHandler;
				let redisAvailable = true;

				// Timeout after 3 minutes
				timeoutId = setTimeout(() => {
					controller.enqueue(encoder.encode('data: {"type":"timeout"}\n\n'));
					controller.close();
				}, 180_000);

				try {
					// Try Redis pub/sub
					const { resolveRedisConnection } = await import(
						"@techstream/quark-core"
					);
					const { default: Redis } = await import("ioredis");
					const conn = resolveRedisConnection();
					const subscriber = new Redis({
						...conn,
						lazyConnect: true,
						maxRetriesPerRequest: 0,
					});
					await subscriber.connect();
					const channel = `ai:stream:${conversationId}`;

					await subscriber.subscribe(channel);

					messageHandler = (_channel, message) => {
						try {
							const data = JSON.parse(message);
							controller.enqueue(encoder.encode(`data: ${message}\n\n`));
							if (data.type === "done" || data.type === "error") {
								clearTimeout(timeoutId);
								subscriber.unsubscribe(channel);
								subscriber.disconnect();
								controller.close();
							}
						} catch {
							// Skip malformed messages
						}
					};

					subscriber.on("message", messageHandler);
				} catch {
					// Redis unavailable - fallback to polling
					redisAvailable = false;

					const pollInterval = setInterval(async () => {
						try {
							const lastMessage = await prisma.aiMessage.findFirst({
								where: { conversationId },
								orderBy: { createdAt: "desc" },
							});

							if (lastMessage && lastMessage.role === "assistant") {
								controller.enqueue(
									encoder.encode(
										`data: ${JSON.stringify({ type: "message", content: lastMessage.content })}\n\n`,
									),
								);
								controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
								clearTimeout(timeoutId);
								clearInterval(pollInterval);
								controller.close();
							}
						} catch {
							// Continue polling
						}
					}, 1000);

					// Cleanup on cancel
					request.signal?.addEventListener("abort", () => {
						clearTimeout(timeoutId);
						clearInterval(pollInterval);
						controller.close();
					});
				}

				// Cleanup on cancel (Redis path)
				if (redisAvailable) {
					request.signal?.addEventListener("abort", () => {
						clearTimeout(timeoutId);
						if (messageHandler) {
							// subscriber already cleaned up in messageHandler
						}
						controller.close();
					});
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	} catch (error) {
		return handleError(error);
	}
}
