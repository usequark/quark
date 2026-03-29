import { pingRedis } from "@techstream/quark-core";
import { pingDatabase, prisma } from "@techstream/quark-db";

/**
 * Fetch service health status for Postgres and Redis.
 * @returns {Promise<{ database: { status: string, latencyMs?: number, message?: string }, redis: { status: string, latencyMs?: number, message?: string } }>}
 */
export async function getServiceHealth() {
	const [database, redis] = await Promise.allSettled([
		pingDatabase({ timeout: 3000 }),
		pingRedis({ timeout: 3000 }),
	]);

	return {
		database:
			database.status === "fulfilled"
				? database.value
				: { status: "error", message: database.reason?.message ?? "Unknown" },
		redis:
			redis.status === "fulfilled"
				? redis.value
				: { status: "error", message: redis.reason?.message ?? "Unknown" },
	};
}

/**
 * Fetch job queue statistics grouped by status.
 * @returns {Promise<{ byStatus: Record<string, number>, byQueue: Record<string, number>, total: number }>}
 */
export async function getJobStats() {
	try {
		const [statusCounts, queueCounts, total] = await Promise.all([
			prisma.job.groupBy({
				by: ["status"],
				_count: { status: true },
			}),
			prisma.job.groupBy({
				by: ["queue"],
				_count: { queue: true },
			}),
			prisma.job.count(),
		]);

		const byStatus = {};
		for (const row of statusCounts) {
			byStatus[row.status] = row._count.status;
		}

		const byQueue = {};
		for (const row of queueCounts) {
			byQueue[row.queue] = row._count.queue;
		}

		return { byStatus, byQueue, total };
	} catch {
		return { byStatus: {}, byQueue: {}, total: 0 };
	}
}

/**
 * Fetch recent job history (last 10 jobs).
 * @returns {Promise<object[]>}
 */
export async function getRecentJobs() {
	try {
		return await prisma.job.findMany({
			take: 10,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				queue: true,
				name: true,
				status: true,
				attempts: true,
				createdAt: true,
				completedAt: true,
				error: true,
			},
		});
	} catch {
		return [];
	}
}
