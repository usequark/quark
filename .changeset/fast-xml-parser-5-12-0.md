---
"@usequark/quark-create-app": patch
---

Raise the `fast-xml-parser` override floor to `>=5.12.0` (GHSA-474x-hrwr-fgx4).
The vulnerable copy arrived transitively through `@aws-sdk/core` ->
`@aws-sdk/xml-builder`, so the fix is a `pnpm.overrides` floor in the scaffold
template's `pnpm-workspace.yaml` plus a lockfile refresh; no direct dependency
changed.
