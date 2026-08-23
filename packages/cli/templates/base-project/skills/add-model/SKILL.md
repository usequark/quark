---
name: add-model
description: Add a new Prisma model and query helpers on Quark. Use when the user wants to add a data model, entity, or table.
---

# Add Model Skill

Add a new Prisma model plus the query helpers to read and write it. This is the foundation for any feature that stores data.

## Framework context (build on Quark)

- **Models** live in `packages/db/prisma/schema.prisma`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly in pages/actions.
- After any schema change: `pnpm db:generate` then `pnpm db:migrate`.

## Workflow

1. Add the model to `packages/db/prisma/schema.prisma`.
2. Add query helpers to `packages/db/src/queries.js` — start with `findAll`, `findById`, `create`; add `update`/`delete` when needed.
3. Run `pnpm db:generate` then `pnpm db:migrate`.
4. Add a test near the changed code.

## Patterns to follow

- Every model includes `id String @id @default(cuid())`, `createdAt DateTime @default(now())`, and `updatedAt DateTime @updatedAt`.
- If the data belongs to a signed-in user, relate it to `User` with `onDelete: Cascade` (or `SetNull` when optional).
- Add indexes on fields you query by (`@@index([...])`).
- Do not call `prisma.*` directly in pages or Server Actions — use the query helpers.
