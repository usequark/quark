---
"@usequark/quark-create-app": patch
---

fix(deps): bump `next` to 16.3.8 — four published advisories

Next.js 16.3.6 is affected by four advisories, all patched in 16.3.8:

| Severity | Advisory | Issue |
|---|---|---|
| HIGH | GHSA-cjq9-62q9-8jv4 | SSRF in Image Optimization |
| HIGH | (second HIGH) | — |
| MODERATE | GHSA-f87g-xv8r-7p7x | Information disclosure in App Router metadata image routes via `dynamicParams` bypass |
| MODERATE | GHSA-mcj8-r9mp-w47p | Cache poisoning in SSG/ISR rendering |

`scripts/check-audit.mjs` fails the `Lint & Standards` check on these, which
blocks every PR — not just dependency bumps.

Two pins needed changing, not one:

- `apps/web` — `16.3.6` → `16.3.8`
- `packages/ui` — `16.3.6` → `16.3.8`

`packages/ui` carries `next` as a regular dependency (it renders through the
App Router), so bumping only `apps/web` left 16.3.6 in the tree and the audit
still failed. Scaffolded projects inherit both pins via `sync-templates`.

After the bump: `No new advisories. 3 accepted (0 now resolved).`
