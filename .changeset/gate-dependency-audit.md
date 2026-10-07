---
"@usequark/quark-create-app": patch
---

Add `pnpm audit:check` and enforce it in CI.

`pnpm audit` reports 3 advisories, all in `apps/mobile`'s Expo build toolchain and all
documented as accepted in `docs/dependency-audit.md` — `node-forge` and `braces`, which
have no patched release at all, and `decode-uri-component`, whose fix is ESM-only and
would break the CommonJS `query-string` that calls it.

A bare `pnpm audit` step in CI exits non-zero for any advisory, so it would fail forever
on those three and get ignored. `scripts/check-audit.mjs` instead allowlists the three
GitHub advisory IDs, passes today, and turns red when a fourth appears. When an accepted
one disappears — an upstream fix landed — it prints a notice naming the entry to retire
rather than failing, so the drift is visible.

The check treats "the audit did not run" as a failure, not a clean tree. `pnpm audit`
reports its own errors as JSON on stdout with exit 1, e.g.
`{"error":{"code":"ERR_PNPM_AUDIT_NO_LOCKFILE"}}`, which has no `advisories` key; reading
that as zero advisories turns a missing lockfile or unreachable registry into a green
build that verified nothing.

It fails closed on unrecognised report shapes for the same reason: an `advisories` key
that is present but null, or any non-object, is rejected rather than defaulted to an
empty set. So is an advisory with no usable `github_advisory_id` — a legacy or CVE-only
record can never match the allowlist, so dropping it would report a clean tree while a
vulnerability is present. An advisory the check cannot identify is one it cannot clear.
17 tests cover both directions.

The allowlist stays in code rather than `auditConfig.ignoreCves` or `audit.level`, which
mute the audit database and would hide the accepted three as well as anything new.