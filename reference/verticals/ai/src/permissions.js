import { getSharedRedisClient } from "@techstream/quark-config";
import { createLogger } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";

const _logger = createLogger("quark-ai:permissions");
const TOOL_CONFIRM_TIMEOUT_MS = 60_000;

/**
 * Resolve user tool access level. Defaults to "auto" when no override exists.
 *
 * @param {string} userId
 * @param {string} toolName
 * @returns {Promise<"auto"|"confirm"|"disabled">}
 */
export async function getUserToolAccessLevel(userId, toolName) {
	if (!userId) return "auto";
	const permission = await prisma.aiToolPermission.findUnique({
		where: {
			userId_toolName: { userId, toolName },
		},
		select: { accessLevel: true },
	});
	return permission?.accessLevel || "auto";
}

/**
 * Wait for user tool confirmation via Redis pub/sub.
 *
 * @param {string} callId
 * @param {number} [timeoutMs]
 * @param {object} [redisClient] - Optional injected Redis client (for testing)
 * @returns {Promise<{ approved: boolean, timedOut?: boolean }>}
 */
export async function waitForToolConfirmation(
	callId,
	timeoutMs = TOOL_CONFIRM_TIMEOUT_MS,
	redisClient,
) {
	const client = redisClient || (await getSharedRedisClient());
	if (!client) {
		return { approved: false, timedOut: true };
	}

	const channel = `ai:tool-confirm:${callId}`;
	const subscriber = client.duplicate();

	return new Promise((resolve) => {
		let settled = false;

		const finish = async (result) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try {
				subscriber.removeListener("message", onMessage);
				await subscriber.unsubscribe(channel);
			} catch {
				// best-effort cleanup
			}
			try {
				subscriber.disconnect();
			} catch {
				// best-effort cleanup
			}
			resolve(result);
		};

		const onMessage = (_ch, message) => {
			try {
				const data = JSON.parse(message);
				finish({ approved: Boolean(data.approved) });
			} catch {
				// ignore malformed messages
			}
		};

		const timer = setTimeout(() => {
			finish({ approved: false, timedOut: true });
		}, timeoutMs);

		(async () => {
			try {
				if (subscriber.status !== "ready") {
					await subscriber.connect();
				}
				subscriber.on("message", onMessage);
				await subscriber.subscribe(channel);
			} catch (error) {
				_logger.warn("Failed to subscribe for tool confirmation", {
					error: error.message,
					callId,
				});
				await finish({ approved: false, timedOut: true });
			}
		})();
	});
}
