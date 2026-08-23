---
"@techstream/quark-create-app": minor
---

feat: replace recipes with embedded skills; archive bookings; remove worker AI subsystem

- **Embedded skills**: replaced the `recipes/` prompt library with a `skills/` directory in the base scaffold. Ships skills for building bookings, CRM, CMS, and AI systems, plus generic skills (add-model, add-endpoint, add-dashboard). Each skill carries the domain context, Quark framework patterns, workflow, end-result shape, and a pointer to the archived reference implementation.
- **CLI**: the `recipe` command now reads from `skills/`; feature rows/guides reference `skills/`; starter detection checks the API route instead of a recipe file.
- **Archive bookings**: copied the bookings starter to `reference/verticals/bookings/` as the skill's reference.
- **Worker AI subsystem removed**: the scaffolded worker no longer ships AI handlers/libs (`context-extraction`, `conversation-compact`, `openrouter`, `summarize`, `truncation`, `tools`) or AI job names — the AI skill teaches how to build them.
- **Smoke test**: added a minimal-scaffold check that verifies the base scaffold has no demoted-vertical references and ships the embedded skills.
