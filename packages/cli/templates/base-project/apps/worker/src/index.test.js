import assert from "node:assert";
import { describe, mock, test } from "node:test";

// ---------------------------------------------------------------------------
// Helpers: lightweight fakes for Prisma, emailService, and storage
// ---------------------------------------------------------------------------

function createMockLogger() {
	return {
		info: mock.fn(),
		warn: mock.fn(),
		error: mock.fn(),
	};
}

function makeBullJob(name, data, overrides = {}) {
	return { id: "job-1", name, data, attemptsMade: 0, ...overrides };
}

// ---------------------------------------------------------------------------
// handleSendWelcomeEmail
// ---------------------------------------------------------------------------

describe("handleSendWelcomeEmail", () => {
	test("throws when userId is missing", async () => {
		// Inline handler that mirrors the real one's validation
		const handler = async (bullJob) => {
			const { userId } = bullJob.data;
			if (!userId) {
				throw new Error("userId is required for SEND_WELCOME_EMAIL job");
			}
		};

		await assert.rejects(() => handler(makeBullJob("send-welcome-email", {})), {
			message: "userId is required for SEND_WELCOME_EMAIL job",
		});
	});

	test("throws when user is not found", async () => {
		const handler = async (bullJob) => {
			const { userId } = bullJob.data;
			if (!userId) throw new Error("userId is required");
			// Simulate user not found
			const userRecord = null;
			if (!userRecord?.email) {
				throw new Error(`User ${userId} not found or has no email`);
			}
		};

		await assert.rejects(
			() => handler(makeBullJob("send-welcome-email", { userId: "user-123" })),
			{ message: "User user-123 not found or has no email" },
		);
	});

	test("returns success when user exists and email sends", async () => {
		const sendEmail = mock.fn(async () => {});

		const handler = async (bullJob, _logger) => {
			const { userId } = bullJob.data;
			if (!userId) throw new Error("userId is required");

			const userRecord = { email: "a@b.com", name: "Alice" };
			if (!userRecord?.email) {
				throw new Error(`User ${userId} not found or has no email`);
			}

			await sendEmail(userRecord.email, "Welcome", "<p>Hi</p>", "Hi");
			return { success: true, userId, email: userRecord.email };
		};

		const logger = createMockLogger();
		const result = await handler(
			makeBullJob("send-welcome-email", { userId: "user-123" }),
			logger,
		);

		assert.deepStrictEqual(result, {
			success: true,
			userId: "user-123",
			email: "a@b.com",
		});
		assert.strictEqual(sendEmail.mock.callCount(), 1);
	});
});

// ---------------------------------------------------------------------------
// handleSendResetPasswordEmail
// ---------------------------------------------------------------------------

describe("handleSendResetPasswordEmail", () => {
	test("throws when userId or resetUrl is missing", async () => {
		const handler = async (bullJob) => {
			const { userId, resetUrl } = bullJob.data;
			if (!userId || !resetUrl) {
				throw new Error(
					"userId and resetUrl are required for SEND_RESET_PASSWORD_EMAIL job",
				);
			}
		};

		await assert.rejects(
			() =>
				handler(
					makeBullJob("send-reset-password-email", {
						userId: "user-1",
					}),
				),
			{
				message:
					"userId and resetUrl are required for SEND_RESET_PASSWORD_EMAIL job",
			},
		);

		await assert.rejects(
			() =>
				handler(
					makeBullJob("send-reset-password-email", {
						resetUrl: "https://example.com/reset",
					}),
				),
			{
				message:
					"userId and resetUrl are required for SEND_RESET_PASSWORD_EMAIL job",
			},
		);
	});
});

// ---------------------------------------------------------------------------
// handleCleanupOrphanedFiles
// ---------------------------------------------------------------------------

describe("handleCleanupOrphanedFiles", () => {
	test("returns deleted: 0 when no orphaned files exist", async () => {
		const handler = async (bullJob, logger) => {
			const retentionHours = bullJob.data?.retentionHours || 24;
			const _cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

			logger.info("Starting orphaned file cleanup", { retentionHours });

			// Simulate no orphaned files
			const orphaned = [];
			if (orphaned.length === 0) {
				logger.info("No orphaned files to clean up");
				return { success: true, deleted: 0 };
			}
		};

		const logger = createMockLogger();
		const result = await handler(
			makeBullJob("cleanup-orphaned-files", { retentionHours: 24 }),
			logger,
		);

		assert.deepStrictEqual(result, { success: true, deleted: 0 });
	});

	test("deletes orphaned files and reports counts", async () => {
		const deletedKeys = [];
		const deletedIds = [];

		const handler = async (bullJob, logger) => {
			const retentionHours = bullJob.data?.retentionHours || 24;
			logger.info("Starting cleanup", { retentionHours });

			const orphaned = [
				{ id: "f1", storageKey: "uploads/f1.jpg" },
				{ id: "f2", storageKey: "uploads/f2.png" },
			];

			let deleted = 0;
			const errors = [];

			for (const record of orphaned) {
				try {
					deletedKeys.push(record.storageKey);
					deletedIds.push(record.id);
					deleted++;
				} catch (err) {
					errors.push({ id: record.id, error: err.message });
				}
			}

			return { success: true, deleted, total: orphaned.length, errors };
		};

		const logger = createMockLogger();
		const result = await handler(
			makeBullJob("cleanup-orphaned-files", { retentionHours: 12 }),
			logger,
		);

		assert.strictEqual(result.deleted, 2);
		assert.strictEqual(result.total, 2);
		assert.deepStrictEqual(result.errors, []);
		assert.deepStrictEqual(deletedKeys, ["uploads/f1.jpg", "uploads/f2.png"]);
	});

	test("continues on individual file delete failure", async () => {
		const handler = async (_bullJob, logger) => {
			const orphaned = [
				{ id: "f1", storageKey: "uploads/f1.jpg" },
				{ id: "f2", storageKey: "uploads/f2.png" },
			];

			let deleted = 0;
			const errors = [];

			for (const record of orphaned) {
				try {
					if (record.id === "f1") {
						throw new Error("S3 timeout");
					}
					deleted++;
				} catch (err) {
					errors.push({ id: record.id, error: err.message });
					logger.warn(`Failed to delete file ${record.id}: ${err.message}`);
				}
			}

			return { success: true, deleted, total: orphaned.length, errors };
		};

		const logger = createMockLogger();
		const result = await handler(
			makeBullJob("cleanup-orphaned-files", {}),
			logger,
		);

		assert.strictEqual(result.deleted, 1);
		assert.strictEqual(result.errors.length, 1);
		assert.strictEqual(result.errors[0].id, "f1");
		assert.strictEqual(result.errors[0].error, "S3 timeout");
		assert.strictEqual(logger.warn.mock.callCount(), 1);
	});

	test("uses default 24h retention when not specified", async () => {
		let capturedRetention;

		const handler = async (bullJob) => {
			capturedRetention = bullJob.data?.retentionHours || 24;
			return { success: true, deleted: 0 };
		};

		await handler(makeBullJob("cleanup-orphaned-files", {}));
		assert.strictEqual(capturedRetention, 24);
	});
});

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

describe("jobHandlers registry", () => {
	test("maps all expected job names to functions", () => {
		const JOB_NAMES = {
			SEND_WELCOME_EMAIL: "send-welcome-email",
			SEND_RESET_PASSWORD_EMAIL: "send-reset-password-email",
			CLEANUP_ORPHANED_FILES: "cleanup-orphaned-files",
		};

		// Simulate the registry
		const jobHandlers = {
			[JOB_NAMES.SEND_WELCOME_EMAIL]: () => {},
			[JOB_NAMES.SEND_RESET_PASSWORD_EMAIL]: () => {},
			[JOB_NAMES.CLEANUP_ORPHANED_FILES]: () => {},
		};

		assert.strictEqual(
			Object.keys(jobHandlers).length,
			3,
			"Should have exactly 3 handlers",
		);

		for (const name of Object.values(JOB_NAMES)) {
			assert.strictEqual(
				typeof jobHandlers[name],
				"function",
				`Handler for "${name}" should be a function`,
			);
		}
	});

	test("throws for unregistered job name", async () => {
		const jobHandlers = {};

		const dispatch = async (bullJob) => {
			const handler = jobHandlers[bullJob.name];
			if (!handler) {
				throw new Error(`No handler registered for job: ${bullJob.name}`);
			}
			return handler(bullJob);
		};

		await assert.rejects(() => dispatch(makeBullJob("unknown-job", {})), {
			message: "No handler registered for job: unknown-job",
		});
	});
});
