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
build that verified nothing. That case is covered by a test along with the other nine.

The allowlist stays in code rather than `auditConfig.ignoreCves` or `audit.level`, which
mute the audit database and would hide the accepted three as well as anything new.