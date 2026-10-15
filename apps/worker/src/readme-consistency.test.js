import assert from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { JOB_NAMES } from "@usequark/quark-jobs";
import { jobHandlers } from "./handlers/index.js";
import { renderHandlerTable, TABLE_END, TABLE_START } from "./readme-table.js";

const readmePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"README.md",
);

function readmeHandlerTable() {
	const readme = readFileSync(readmePath, "utf-8");
	const start = readme.indexOf(TABLE_START);
	const end = readme.indexOf(TABLE_END);
	assert.notStrictEqual(start, -1, `README must contain ${TABLE_START}`);
	assert.ok(
		end > start,
		`README must contain ${TABLE_END} after ${TABLE_START}`,
	);
	return readme.slice(start + TABLE_START.length, end).trim();
}

describe("README job handler table", () => {
	test("every JOB_NAME has a registered handler", () => {
		// Asserted against the shipped registry: a job name added to the jobs
		// package with no handler in handlers/index.js fails here instead of
		// shipping a job no worker can process.
		for (const jobName of Object.values(JOB_NAMES)) {
			assert.strictEqual(
				typeof jobHandlers[jobName],
				"function",
				`JOB_NAMES lists "${jobName}" but handlers/index.js registers no handler for it`,
			);
		}
	});

	test("README table is generated from JOB_NAMES", () => {
		// The README table is rendered from JOB_NAMES, so it can never agree
		// with a stale table: a row for a job name that no longer exists (the
		// old `send-push-notification` row, for instance) or a missing row for
		// a new job name both fail this assertion.
		assert.strictEqual(
			readmeHandlerTable(),
			renderHandlerTable(jobHandlers),
			"README handler table disagrees with JOB_NAMES — regenerate it with renderHandlerTable()",
		);
	});
});
