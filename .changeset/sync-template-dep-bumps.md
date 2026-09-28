---
"@techstream/quark-create-app": patch
---

Sync generated templates after the development dependency bump

`sync-templates:check` (Template Drift Check) failed on `main` after the
dependabot dev-dependency update, because the scaffold templates pin the same
version ranges. Re-synced `apps/web`, `db`, `ui`, `worker`, and `mobile`
template manifests so newly scaffolded projects install the current versions.
