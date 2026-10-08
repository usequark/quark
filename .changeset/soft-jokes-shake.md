---
"@usequark/quark-create-app": patch
---

Upgrade Next.js from `16.3.6` to `16.3.8`, clearing six advisories and failing
`pnpm audit:check` in CI. Two are production-reachable: SSRF in Image Optimization
(`GHSA-cjq9-62q9-8jv4`) and SSG/ISR cache poisoning leading to cross-user content
substitution and persistent DoS (`GHSA-mcj8-r9mp-w47p`). The other four are Draft Mode
content leakage, metadata image route disclosure, a self-hosted cache poisoning variant,
and a dev-server MCP disclosure.

The bump is a patch within Next 16, so the scaffolded template changes with it: new
projects no longer pin the vulnerable version. Both `apps/web` and `packages/ui` move, and
`sync-templates` propagates to `templates/base-project/apps/web/package.json` and
`templates/ui/package.json`.

The three deliberately accepted Expo build-toolchain advisories are unaffected. Full
write-up in `docs/dependency-audit.md`.