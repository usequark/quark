---
"@techstream/quark-create-app": patch
---

Sync pnpm.overrides from the monorepo root into the scaffold root template so scaffolded projects pick up security overrides (deepmerge-ts, fast-uri) and stop failing Trivy image scans.
