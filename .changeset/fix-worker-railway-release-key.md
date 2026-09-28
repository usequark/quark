---
"@techstream/quark-create-app": patch
---

Fix worker `railway.json` deploy config (remove the invalid `release.command` key — migrations run once on the web service via `deploy.releaseCommand`), pin the Node runtime with a scaffolded `.nvmrc`, and validate railway.json keys before deploy so invalid config fails fast instead of silently no-oping.
