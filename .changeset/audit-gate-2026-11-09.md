---
"@usequark/quark-core": patch
"@usequark/quark-create-app": patch
---

Security dependency updates (2026-11-09 audit pass): `next` 16.3.8 -> 16.4.1
(fixes 2 critical + 1 high in scaffolded apps, synced to templates), `nodemailer`
floor `^10.1.4`, `zod` floor `^4.6.6`, plus same-major overrides for
`node-forge`, `undici`, `fast-uri`, `launch-editor` and `qs`. Audit allowlist
updated: 2 entries retired (fixed upstream), 5 new documented accepts — full
reasoning in `docs/dependency-audit.md`.
