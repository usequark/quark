import {
	ForbiddenError,
	NotFoundError,
	UnauthorizedError,
} from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";

/**
 * Requires authentication and returns the session.
 * @returns {Promise<Object>} session
 */
export async function requireAuth() {
	const { getServerSession } = await import("next-auth");
	const session = await getServerSession();
	if (!session?.user) {
		throw new UnauthorizedError("You must be logged in");
	}
	return session;
}

/**
 * Checks if user has access to a conversation.
 * Admin and lead_dev can access any conversation.
 * Regular users can only access their own.
 * @param {string} conversationId
 * @param {Object} session
 * @returns {Promise<Object>} conversation with messages
 */
export async function requireConversationAccess(conversationId, session) {
	const conversation = await prisma.aiConversation.findUnique({
		where: { id: conversationId },
		include: { messages: { orderBy: { createdAt: "asc" } } },
	});

	if (!conversation || conversation.deletedAt) {
		throw new NotFoundError("Conversation not found");
	}

	const userRole = session.user?.role;
	const isPrivileged = userRole === "admin" || userRole === "lead_dev";
	const isOwner = conversation.userId === session.user?.id;

	if (!isPrivileged && !isOwner) {
		throw new ForbiddenError("You do not have access to this conversation");
	}

	return conversation;
}
