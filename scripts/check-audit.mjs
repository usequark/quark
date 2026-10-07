import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * `pnpm audit` exits non-zero whenever it finds *any* advisory, so a bare
 * `pnpm audit` step in CI would fail on the three Expo build-toolchain
 * advisories this repo deliberately accepts - and would have failed the build
 * forever, which is how a security gate turns into noise people learn to skip.
 *
 * Those three are documented in docs/dependency-audit.md. Two of them
 * (`node-forge`, `braces`) have no patched release at all: their `patched_versions`
 * is `<0.0.0`, and the resolved version *is* the newest published. The third
 * (`decode-uri-component`) needs >=0.5.0, which is ESM-only, while
 * `query-string@7.1.3` is CommonJS and calls it as a function - forcing the
 * upgrade breaks it at runtime with `TypeError: m is not a function`.
 *
 * All three sit in `apps/mobile`'s Expo toolchain and none ships in a JS bundle,
 * so they cannot be fixed without breaking something else. What *can* be fixed is
 * a fourth advisory appearing, and `pnpm audit` alone cannot tell those apart.
 *
 * So the gate is an allowlist keyed on the GitHub advisory ID, which is stable
 * across advisory metadata edits in a way the npm advisory ID is not.
 *
 * Deliberately NOT done, matching docs/dependency-audit.md: no
 * `auditConfig.ignoreCves` and no `audit.level` change. Silencing the audit
 * database would hide these three as well as anything new, which is the opposite
 * of what this check is for. The allowlist lives here, in code, where it is
 * reviewable and diffable.
 *
 * When an upstream package finally ships a fix, the advisory stops appearing and
 * this script prints a notice naming the entry to retire. That is the signal to
 * delete it from this list and update docs/dependency-audit.md.
 */
const acceptedAdvisories = {
	"GHSA-86w9-cpqp-85rv": {
		module: "node-forge",
		severity: "high",
		reason:
			"No patched release exists (patched_versions is `<0.0.0`; 1.4.0 is newest). Build-time only, Expo code signing. Do not override - there is nothing to force it to.",
	},
	"GHSA-vfj7-8cjw-p6xm": {
		module: "braces",
		severity: "high",
		reason:
			"No patched release exists (patched_versions is `<0.0.0`; 3.0.3 is newest). Build-time only, via Expo's file-map glob matching. Needs a pathological repo-authored glob to reach.",
	},
	"GHSA-vcc3-ghjq-m6fr": {
		module: "decode-uri-component",
		severity: "moderate",
		reason:
			"Fix requires >=0.5.0, which is ESM-only; `query-string@7.1.3` is CommonJS and calls it as a function, so the upgrade breaks it. Build-time only, via Expo router.",
	},
};

async function readAuditReport() {
	// Test seam: the real report needs the lockfile and a reachable registry, and
	// the tests must depend on neither. Given a path, read the JSON from disk
	// instead of shelling out - including the malformed shapes the real command
	// can produce, which are exactly the cases worth testing.
	const fixturePath = process.env.CHECK_AUDIT_FIXTURE;
	if (fixturePath) {
		const { readFile } = await import("node:fs/promises");
		return readFile(fixturePath, "utf8");
	}

	// pnpm audit exits non-zero when it finds advisories, which is the normal
	// state here, so a rejected promise is not an error - the JSON is still on
	// stdout. Only a failure to produce parseable JSON is an error.
	let raw;
	try {
		({ stdout: raw } = await execFileAsync("pnpm", ["audit", "--json"], {
			maxBuffer: 32 * 1024 * 1024,
		}));
	} catch (error) {
		raw = error?.stdout;
		if (typeof raw !== "string" || raw.trim() === "") {
			// No JSON at all means the audit itself failed (offline, registry
			// unreachable, lockfile unreadable). That is not evidence of a clean
			// tree, so it must not pass silently.
			process.stderr.write(
				"❌ Could not read a pnpm audit report.\n" +
					"If the registry is unreachable this check cannot vouch for the tree.\n\n" +
					`${error?.message ?? error}\n`,
			);
			process.exit(1);
		}
	}

	return raw;
}

/**
 * Turn raw pnpm audit output into the list of advisories, refusing anything whose
 * shape we do not recognise rather than reading it as "none found".
 */
function parseAuditReport(raw) {
	let report;
	try {
		report = JSON.parse(raw);
	} catch {
		process.stderr.write(
			"❌ pnpm audit did not return JSON. Refusing to pass a tree we cannot read.\n",
		);
		process.exit(1);
	}

	// pnpm reports its *own* failures as JSON on stdout with exit code 1, e.g.
	//
	//   { "error": { "code": "ERR_PNPM_AUDIT_NO_LOCKFILE", ... } }
	//
	// which has no `advisories` key at all. Reading that as "zero advisories"
	// turns a missing lockfile, an unreachable registry or a corrupted tree into
	// a green build that verified nothing - the exact silent-pass this check
	// exists to prevent. An audit that could not run must fail loudly.
	if (report?.error) {
		process.stderr.write(
			`❌ pnpm audit could not run: ${report.error.code ?? "unknown error"}\n` +
				`   ${report.error.message ?? ""}\n\n` +
				"This is not evidence of a clean tree - no advisories were enumerated.\n\n",
		);
		process.exit(1);
	}

	// Belt and braces: require the shape we expect before trusting a count. An
	// `advisories` key that is present but null, or any non-object, means we are
	// not looking at an audit report - `?? {}` would quietly substitute an empty
	// set and pass, so it has to be rejected rather than defaulted.
	if (
		!report ||
		typeof report !== "object" ||
		!("advisories" in report) ||
		!report.advisories ||
		typeof report.advisories !== "object" ||
		Array.isArray(report.advisories)
	) {
		process.stderr.write(
			"❌ pnpm audit returned JSON without a usable `advisories` object. Refusing to pass a tree we cannot read.\n",
		);
		process.exit(1);
	}

	// A present-but-unusable `advisories` key and a missing one are the same
	// situation for our purposes: no advisories were enumerated.
	const advisories = Object.values(report.advisories);

	// Every advisory must carry a GitHub advisory ID, because that ID is the
	// allowlist key. Dropping entries that lack one would be fail-open in the
	// worst direction: a legacy or CVE-only record with `github_advisory_id: null`
	// is a real vulnerability that can never be matched against acceptedAdvisories,
	// so filtering it out reports a clean tree while a known advisory is present.
	// An entry we cannot identify is one we cannot clear.
	const unidentified = advisories.filter(
		(advisory) =>
			!advisory ||
			typeof advisory !== "object" ||
			typeof advisory.github_advisory_id !== "string" ||
			advisory.github_advisory_id === "",
	);

	if (unidentified.length > 0) {
		process.stderr.write(
			`\n❌ ${unidentified.length} ${unidentified.length === 1 ? "advisory carries" : "advisories carry"} no GitHub advisory ID, so ${unidentified.length === 1 ? "it" : "they"} cannot be matched against the allowlist.\n\n` +
				`Dropping ${unidentified.length === 1 ? "it" : "them"} would report a clean tree while a vulnerability is\n` +
				"present. Failing closed instead.\n\n",
		);
		process.exit(1);
	}

	return advisories;
}

const advisories = parseAuditReport(await readAuditReport());

const unexpected = advisories.filter(
	(advisory) => !(advisory.github_advisory_id in acceptedAdvisories),
);
const retired = Object.keys(acceptedAdvisories).filter(
	(id) => !advisories.some((advisory) => advisory.github_advisory_id === id),
);

if (retired.length > 0) {
	process.stdout.write(
		"\n📉 Accepted advisories no longer reported - an upstream fix may have landed.\n" +
			"Delete these from acceptedAdvisories in scripts/check-audit.mjs and update\n" +
			"docs/dependency-audit.md:\n\n" +
			retired
				.map((id) => `     ${id}  (${acceptedAdvisories[id].module})`)
				.join("\n") +
			"\n\n",
	);
}

if (unexpected.length === 0) {
	const accepted = advisories.length;
	process.stdout.write(
		`✅ No new advisories. ${accepted} accepted (${retired.length} now resolved).\n`,
	);
	process.exit(0);
}

process.stderr.write(
	`\n❌ ${unexpected.length} unaccepted ${unexpected.length === 1 ? "advisory" : "advisories"} in the dependency tree.\n\n`,
);

for (const advisory of unexpected) {
	process.stderr.write(
		`   ${String(advisory.severity ?? "unknown").toUpperCase()}  ${advisory.module_name ?? "unknown"}  ${advisory.github_advisory_id}\n` +
			`          ${advisory.title}\n` +
			`          patched: ${advisory.patched_versions || "none published"}\n` +
			`          ${advisory.recommendation || advisory.url || ""}\n`,
	);
}

process.stderr.write(
	"\nFix these, or - if an upstream package genuinely has no patched release and the\n" +
		"code path is not shipped - add them to acceptedAdvisories in\n" +
		"scripts/check-audit.mjs with a reason, and document them in\n" +
		"docs/dependency-audit.md.\n\n" +
		"Do not silence this with auditConfig.ignoreCves or audit.level: those hide\n" +
		"the accepted three as well as anything new.\n\n",
);

process.exit(1);
