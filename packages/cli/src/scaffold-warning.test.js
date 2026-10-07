import assert from "node:assert";
import { test } from "node:test";

import { warnIfJobsOmitted } from "./scaffold-warning.js";

/** Captures what the warning writes, so it can be asserted without scaffolding. */
function capture(features) {
	const lines = [];
	const printed = warnIfJobsOmitted(features, (line) =>
		lines.push(String(line)),
	);
	return { output: lines.join("\n"), printed };
}

test("warnIfJobsOmitted warns when jobs is not selected", () => {
	const { output, printed } = capture(["ui"]);

	assert.strictEqual(printed, true);
	// The warning has to name the consequence, not just the omission. "Background
	// jobs omitted" alone is a feature note; the orphaned files are the problem,
	// and the person deciding needs that before they decide.
	assert.match(output, /orphaned/);
	assert.match(output, /nothing sweeps them/);
	// And the escape hatch, so the warning is actionable rather than fatalistic.
	assert.match(output, /add jobs/);
});

test("warnIfJobsOmitted says nothing when jobs is selected", () => {
	assert.strictEqual(capture(["ui", "jobs"]).printed, false);
	assert.strictEqual(capture(["ui", "jobs"]).output, "");
	assert.strictEqual(capture(["jobs"]).printed, false);
});

test("warnIfJobsOmitted warns for an empty feature list", () => {
	// `--packages` with nothing selected resolves to an empty list. That is the case
	// where the warning matters most, so a truthiness guard on the list would
	// wrongly skip it.
	assert.match(capture([]).output, /orphaned/);
	assert.strictEqual(capture([]).printed, true);
});

test("warnIfJobsOmitted leaves the choice reversible", () => {
	// It warns, it does not block: the return value is informational and no error is
	// thrown, so a worker-less project still scaffolds.
	assert.doesNotThrow(() => warnIfJobsOmitted(["ui"], () => {}));
});
