import { prisma } from "@techstream/quark-db";

/**
 * Record an AI tool audit event. When callId is provided, upserts so
 * proposed → approved/denied transitions share one row.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.conversationId]
 * @param {string} params.toolName
 * @param {unknown} [params.input]
 * @param {string} params.status - proposed | approved | denied | timed_out | auto_executed | skipped
 * @param {string} [params.reason] - disabled | denied | timeout | timed_out | null
 * @param {string} [params.callId]
 */
export async function recordToolEvent({
	userId,
	conversationId,
	toolName,
	input,
	status,
	reason,
	callId,
}) {
	if (callId) {
		return prisma.aiToolEvent.upsert({
			where: { callId },
			create: {
				userId,
				conversationId: conversationId || null,
				toolName,
				input: input ?? undefined,
				status,
				reason: reason || null,
				callId,
			},
			update: {
				status,
				reason: reason || null,
				...(input !== undefined ? { input } : {}),
			},
		});
	}

	return prisma.aiToolEvent.create({
		data: {
			userId,
			conversationId: conversationId || null,
			toolName,
			input: input ?? undefined,
			status,
			reason: reason || null,
		},
	});
}

/**
 * List tool audit events, optionally filtered by user.
 *
 * @param {object} [params]
 * @param {string} [params.userId]
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 */
export async function getToolEvents({ userId, limit = 50, offset = 0 } = {}) {
	const where = userId ? { userId } : {};
	const [events, total] = await Promise.all([
		prisma.aiToolEvent.findMany({
			where,
			orderBy: { createdAt: "desc" },
			take: limit,
			skip: offset,
		}),
		prisma.aiToolEvent.count({ where }),
	]);
	return { events, total };
}
