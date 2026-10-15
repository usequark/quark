/**
 * Generates the README job-handler table.
 *
 * The row set is driven by JOB_NAMES (the jobs package is the source of truth
 * for which jobs exist), never by the registry alone: generating from
 * `jobHandlers` would produce a table that always matches what is registered
 * and so could never expose a job name with no handler.
 */

import { AppError } from "@usequark/quark-core/errors";
import { JOB_NAMES } from "@usequark/quark-jobs";

/** Module under `src/handlers/` that defines each job's handler. */
const HANDLER_MODULES = {
	[JOB_NAMES.SEND_WELCOME_EMAIL]: "email.js",
	[JOB_NAMES.SEND_VERIFY_EMAIL]: "email.js",
	[JOB_NAMES.SEND_RESET_PASSWORD_EMAIL]: "email.js",
	[JOB_NAMES.CLEANUP_ORPHANED_FILES]: "files.js",
};

export const TABLE_START = "<!-- handler-table:start -->";
export const TABLE_END = "<!-- handler-table:end -->";

/**
 * Render the handler table for JOB_NAMES, one row per job name.
 * @param {Record<string, Function>} jobHandlers
 * @returns {string} markdown table (marker lines excluded)
 */
export function renderHandlerTable(jobHandlers) {
	const rows = Object.values(JOB_NAMES).map((jobName) => {
		const handler = jobHandlers[jobName];
		const module = HANDLER_MODULES[jobName];
		if (typeof handler !== "function" || !module) {
			throw new AppError(
				`No handler registration or README metadata for job: ${jobName}`,
				500,
				"JOB_README_ROW_MISSING",
			);
		}
		return `| \`${jobName}\` | \`${handler.name}\` (\`handlers/${module}\`) |`;
	});
	return ["| Job name | Handler |", "|---|---|", ...rows].join("\n");
}

/**
 * Replace the marked table block in a README with the generated one.
 * @param {string} markdown
 * @param {Record<string, Function>} jobHandlers
 * @returns {string} updated markdown
 */
export function replaceHandlerTable(markdown, jobHandlers) {
	const start = markdown.indexOf(TABLE_START);
	const end = markdown.indexOf(TABLE_END);
	if (start === -1 || end === -1 || end < start) {
		throw new AppError(
			"README is missing handler-table markers",
			500,
			"JOB_README_MARKERS_MISSING",
		);
	}
	return (
		markdown.slice(0, start + TABLE_START.length) +
		"\n" +
		renderHandlerTable(jobHandlers) +
		"\n" +
		markdown.slice(end)
	);
}
