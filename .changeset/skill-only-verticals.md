---
"@techstream/quark-create-app": minor
---

feat: make verticals skill-only; embed skills in .opencode/skills; rename recipe → skill

- **Verticals are now skill-only**: `bookings`, `crm`, `cms`, and `ai` no longer scaffold starter code. Selecting one just recognizes the feature — the embedded skill (always present) teaches the AI to build it. The starter templates are archived to `reference/verticals/`.
- **Skills embedded for auto-loading**: the skills moved from `skills/` to `.opencode/skills/`, the location opencode auto-loads on context match (no need to point the AI at them).
- **`recipe` command renamed to `skill`**: `quark skill <feature>` prints an embedded skill.
- **Skills enriched**: each vertical skill now includes example Prisma models, Zod validation schemas, and test patterns.
- **Smoke test expanded**: verifies all embedded skills are present and the `skill` command works.
