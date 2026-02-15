---
name: quark-context
description: Specific technical context for the Quark Monorepo. Load this alongside other skills.
---

# Quark Context & Standards
- **Imports:** Use `@techstream/` scope for internal packages.
- **Database:** Prisma + Postgres. Always include `createdAt`/`updatedAt`.
- **UI:** Tailwind CSS + Shadcn. Keep components atomic.
- **Validation:** Zod is mandatory for all Server Actions and API routes.
