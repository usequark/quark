/**
 * Tests for scripts/check-audit.mjs, the CI gate that fails on a dependency
 * advisory the repo has not explicitly accepted.
 *
 * The check runs the real script as a subprocess with CHECK_AUDIT_FIXTURE pointed
 * at a throwaway JSON file, for the same reason check-standards.test.mjs does:
 * the script is top-level and side-effecting with no exports. Fixtures also keep
 * the tests off the network, so they assert our behaviour rather than whatever
 * the registry happens to be publishing today.
 *
 * The cases that matter most are the failures. A security gate that reports a
 * clean tree when it could not read one is worse than no gate at all, because it
 * converts "unknown" into "fine" and nobody looks again. Both directions are
 * covered below for that reason.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"check-audit.mjs",
);

function advisory(githubAdvisoryId, extra = {}) {
	return {
		github_advisory_id: githubAdvisoryId,
		title: `advisory ${githubAdvisoryId}`,
		severity: "high",
		patched_versions: "<0.0.0",
		url: "https://github.com/advisories/x",
		...extra,
	};
}

/** Run the real script against a fixture report. */
function runWith(report) {
	const dir = mkdtempSync(path.join(tmpdir(), "check-audit-"));
	const fixture = path.join(dir, "audit.json");
	writeFileSync(
		fixture,
		typeof report === "string" ? report : JSON.stringify(report),
	);
	try {
		return spawnSync(process.execPath, [scriptPath], {
			encoding: "utf8",
			env: { ...process.env, CHECK_AUDIT_FIXTURE: fixture },
		});
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * The three advisories docs/dependency-audit.md records as accepted, keyed the way
 * pnpm keys its report: by advisory id, with each value also carrying the id.
 */
const ACCEPTED = {
	"GHSA-86w9-cpqp-85rv": advisory("GHSA-86w9-cpqp-85rv", {
		module_name: "node-forge",
	}),
	"GHSA-vfj7-8cjw-p6xm": advisory("GHSA-vfj7-8cjw-p6xm", {
		module_name: "braces",
	}),
	"GHSA-vcc3-ghjq-m6fr": advisory("GHSA-vcc3-ghjq-m6fr", {
		module_name: "decode-uri-component",
		severity: "moderate",
	}),
};

test("passes when the tree is clean", () => {
	const result = runWith({ advisories: {}, metadata: {} });
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /No new advisories/);
});

test("passes when the only advisories are the accepted three", () => {
	const result = runWith({ advisories: ACCEPTED, metadata: {} });
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /No new advisories/);
	assert.match(result.stdout, /3 accepted/);
});

test("fails on an advisory that is not on the allowlist", () => {
	const result = runWith({
		advisories: {
			...ACCEPTED,
			"GHSA-newnew-0000": advisory("GHSA-newnew-0000", {
				module_name: "some-package",
				patched_versions: ">=1.2.3",
			}),
		},
		metadata: {},
	});

	assert.equal(result.status, 1);
	assert.match(result.stderr, /unaccepted advisory/i);
	assert.match(result.stderr, /GHSA-newnew-0000/);
	assert.match(result.stderr, /some-package/);
	// The message must name where the decision is recorded and what to do.
	assert.match(result.stderr, /scripts\/check-audit\.mjs/);
	assert.match(result.stderr, /docs\/dependency-audit\.md/);
});

test("an accepted advisory keeps passing when it is the only one present", () => {
	// Guards against the allowlist being keyed on something unstable like array
	// position or install order.
	const single = runWith({
		advisories: { "GHSA-86w9-cpqp-85rv": advisory("GHSA-86w9-cpqp-85rv") },
		metadata: {},
	});
	assert.equal(single.status, 0, single.stderr);
});

test("fails when pnpm reports its own error instead of a report", () => {
	// pnpm emits { "error": { "code": "ERR_PNPM_AUDIT_NO_LOCKFILE" } } on stdout
	// with exit 1. It has no `advisories` key, so reading it as "zero advisories"
	// would turn a missing lockfile into a green build that verified nothing.
	const result = runWith({
		error: {
			code: "ERR_PNPM_AUDIT_NO_LOCKFILE",
			message: "No pnpm-lock.yaml found",
		},
	});

	assert.equal(result.status, 1, "an audit that could not run must not pass");
	assert.match(result.stderr, /ERR_PNPM_AUDIT_NO_LOCKFILE/);
	assert.match(result.stderr, /not evidence of a clean tree/i);
});

test("fails on JSON that is not an audit report", () => {
	const result = runWith({ metadata: { vulnerabilities: {} } });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /advisories/i);
});

test("fails on output that is not JSON", () => {
	const result = runWith("<html>502 Bad Gateway</html>");
	assert.equal(result.status, 1);
	assert.match(result.stderr, /did not return JSON/i);
});

test("fails on a missing fixture file rather than reporting a clean tree", () => {
	const result = spawnSync(process.execPath, [scriptPath], {
		encoding: "utf8",
		env: {
			...process.env,
			CHECK_AUDIT_FIXTURE: path.join(tmpdir(), "definitely-not-here.json"),
		},
	});
	assert.notEqual(result.status, 0);
});

test("notices when an accepted advisory stops being reported", () => {
	// The signal that an upstream fix landed: drop one from the fixture and the
	// run should still pass, but say which entry is now stale so the allowlist and
	// docs/dependency-audit.md get updated rather than drifting.
	const result = runWith({
		advisories: {
			"GHSA-86w9-cpqp-85rv": advisory("GHSA-86w9-cpqp-85rv"),
			"GHSA-vfj7-8cjw-p6xm": advisory("GHSA-vfj7-8cjw-p6xm"),
		},
		metadata: {},
	});

	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /GHSA-vcc3-ghjq-m6fr/);
	assert.match(result.stdout, /decode-uri-component/);
});

test("warns against silencing the audit instead of fixing it", () => {
	const result = runWith({
		advisories: { "GHSA-newnew-0000": advisory("GHSA-newnew-0000") },
		metadata: {},
	});
	assert.equal(result.status, 1);
	assert.match(result.stderr, /ignoreCves|audit\.level/i);
});
