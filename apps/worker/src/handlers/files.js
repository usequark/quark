/**
 * File Job Handlers
 * Processes file-related background jobs (cleanup, etc.)
 */

import { createStorage } from "@usequark/quark-core/storage";
import { file } from "@usequark/quark-db";
import { JOB_NAMES } from "@usequark/quark-jobs";

/**
 * Job handler for CLEANUP_ORPHANED_FILES
 * Deletes files with no owner that are older than a retention period.
 *
 * @param {import("bullmq").Job} bullJob
 * @param {import("@usequark/quark-core").Logger} logger
 */
export async function handleCleanupOrphanedFiles(bullJob, logger) {
	const retentionHours = bullJob.data?.retentionHours || 24;
	const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

	logger.info("Starting orphaned file cleanup", {
		job: JOB_NAMES.CLEANUP_ORPHANED_FILES,
		retentionHours,
		cutoff: cutoff.toISOString(),
	});

	const orphaned = await file.findOlderThan(cutoff);

	if (orphaned.length === 0) {
		logger.info("No orphaned files to clean up");
		return { success: true, deleted: 0 };
	}

	const storage = createStorage();
	let deleted = 0;
	const errors = [];

	for (const record of orphaned) {
		try {
			// Row first, storage second — same ordering as DELETE /api/files/[id].
			// Storage-first means a failed row delete leaves a row pointing at bytes
			// that are already gone, which cannot be recovered: the blob was the only
			// copy. A failed storage delete here leaves an orphaned blob instead, and
			// this very job is what sweeps those up on a later pass.
			const { count } = await file.deleteIfPresent(record.id);
			// A concurrent request (or an earlier pass of this job) already took it.
			if (count === 0) continue;

			await storage.delete(record.storageKey);
			deleted++;
		} catch (err) {
			errors.push({ id: record.id, error: err.message });
			logger.warn(`Failed to delete file ${record.id}: ${err.message}`);
		}
	}

	logger.info(
		`Orphaned file cleanup complete: ${deleted}/${orphaned.length} deleted`,
		{
			deleted,
			total: orphaned.length,
			errors: errors.length,
		},
	);

	return { success: true, deleted, total: orphaned.length, errors };
}
