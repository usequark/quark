#!/usr/bin/env node

/**
 * check-e2e-perf.js
 *
 * Reads /tmp/e2e-test-results-latest.json (written by test-e2e-full.js) and
 * checks performance thresholds. Designed to run after test:e2e:full in CI
 * to surface timing regressions.
 *
 * Exit codes:
 *   0 – results file missing, or all thresholds OK
 *   1 – lifecycle or production-build duration exceeded its hard threshold
 */

import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

// RUNNER_TEMP is set by GitHub Actions; fall back to os.tmpdir() for local runs.
const RESULTS_FILE = resolve(
	process.env.RUNNER_TEMP ?? tmpdir(),
	"e2e-test-results-latest.json",
);

// Thresholds (milliseconds)
// The lifecycle budget deliberately excludes the production build (reported
// separately as buildDuration) so adding a compile step to the E2E does not
// silently widen the regression gate that was calibrated for the Docker
// lifecycle alone.
const LIFECYCLE_HARD_LIMIT = 120_000; // 2 minutes → hard FAIL
const BUILD_HARD_LIMIT = 300_000; // 5 minutes for the production build → hard FAIL
const BUILD_WARN_LIMIT = 150_000; // production build warn
const PHASE1_WARN_LIMIT = 60_000; // Phase 1 warn
const PHASE_WARN_LIMIT = 30_000; // Any other phase warn

// ----------------------------------------------------------------------------
// Load results
// ----------------------------------------------------------------------------

let results;
try {
	const raw = readFileSync(resolve(RESULTS_FILE), "utf8");
	results = JSON.parse(raw);
} catch {
	console.log("No results file found. Run test:e2e:full first.");
	process.exit(0);
}

// ----------------------------------------------------------------------------
// Print summary table
// ----------------------------------------------------------------------------

const {
	timestamp,
	passed,
	totalDuration,
	buildDuration = 0,
	lifecycleDuration = totalDuration,
	phases,
	nodeVersion,
	platform,
} = results;

console.log("\n📊 E2E Performance Report");
console.log("=".repeat(60));
console.log(`  Run at:      ${timestamp}`);
console.log(`  Status:      ${passed ? "✅ PASSED" : "❌ FAILED"}`);
console.log(`  Node:        ${nodeVersion}`);
console.log(`  Platform:    ${platform}`);
console.log(`  Total:       ${(totalDuration / 1000).toFixed(2)}s`);
console.log(
	`  Lifecycle:   ${(lifecycleDuration / 1000).toFixed(2)}s  (limit ${LIFECYCLE_HARD_LIMIT / 1000}s)`,
);
console.log(
	`  Build:       ${(buildDuration / 1000).toFixed(2)}s  (limit ${BUILD_HARD_LIMIT / 1000}s)`,
);
console.log("");
console.log("  Phase Durations:");
console.log(`  ${"-".repeat(56)}`);

for (const phase of phases) {
	const secs = (phase.duration / 1000).toFixed(2);
	const pad = phase.name.padEnd(48, ".");
	console.log(`  ${pad} ${secs.padStart(6)}s`);
}

console.log("=".repeat(60));

// ----------------------------------------------------------------------------
// Threshold checks
// ----------------------------------------------------------------------------

let hasRegression = false;
const warnings = [];

// Hard limit: lifecycle duration (excludes the production build phase)
if (lifecycleDuration > LIFECYCLE_HARD_LIMIT) {
	hasRegression = true;
	console.log(
		`\n❌ FAIL: Lifecycle duration ${(lifecycleDuration / 1000).toFixed(2)}s exceeds ${LIFECYCLE_HARD_LIMIT / 1000}s limit`,
	);
}

// Hard limit: production build duration
if (buildDuration > BUILD_HARD_LIMIT) {
	hasRegression = true;
	console.log(
		`\n❌ FAIL: Build duration ${(buildDuration / 1000).toFixed(2)}s exceeds ${BUILD_HARD_LIMIT / 1000}s limit`,
	);
}

// Phase-level warnings. The production build is judged above, not as a phase.
for (const phase of phases) {
	if (phase.name.includes("Production Build")) {
		continue;
	}
	const isPhase1 = phase.name.startsWith("Phase 1");
	const limit = isPhase1 ? PHASE1_WARN_LIMIT : PHASE_WARN_LIMIT;

	if (phase.duration > limit) {
		warnings.push(
			`  ⚠  ${phase.name}: ${(phase.duration / 1000).toFixed(2)}s (limit ${limit / 1000}s)`,
		);
	}
}

if (buildDuration > BUILD_WARN_LIMIT) {
	warnings.push(
		`  ⚠  Production Build: ${(buildDuration / 1000).toFixed(2)}s (warn above ${BUILD_WARN_LIMIT / 1000}s)`,
	);
}

if (warnings.length > 0) {
	console.log("\n⚠  Phase warnings:");
	for (const w of warnings) {
		console.log(w);
	}
}

// ----------------------------------------------------------------------------
// Final verdict
// ----------------------------------------------------------------------------

if (hasRegression) {
	console.log("\n⚠  Performance regression detected\n");
	process.exit(1);
} else {
	console.log("\n✅ Performance OK\n");
	process.exit(0);
}
