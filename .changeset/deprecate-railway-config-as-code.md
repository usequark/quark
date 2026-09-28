---
"@techstream/quark-create-app": patch
---

Deprecate the railway.json deploy path: Railway has deprecated Config as Code (railway.json/railway.toml, hard cutoff 2026-12-01) in favor of Infrastructure as Code (.railway/railway.ts). New services can no longer opt into Config as Code. Document the migration in docs/DEPLOY_RAILWAY.md; the `quark deploy railway` command and templates must be migrated to IaC.
