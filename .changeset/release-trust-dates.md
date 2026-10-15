---
"@usequark/quark-core": patch
"@usequark/quark-create-app": patch
---

Date every release and write down the release policy. `scripts/release-version.mjs` (the release workflow's `version` step) now runs `node scripts/stamp-changelog-dates.mjs` after `changeset version`, so each new CHANGELOG heading lands as `## x.y.z - YYYY-MM-DD`; only the just-added heading is stamped and already-dated or historical headings are never rewritten. Adds `docs/UPGRADING.md` (per-major skeleton, 2.6.2/2.7.0 backfills, pending Wave-1 notes) and states the semver policy in `CONTRIBUTING.md` (security-default and behaviour changes ship as minor/major with a migration note; patch is docs/tests only). Backfills the verified 2026-10-11 date onto the current 2.8.0 / 1.26.0 headings. Docs and CI only — no runtime behaviour change.
