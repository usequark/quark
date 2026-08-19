---
name: Add a Prisma model
feature: model
files:
  - packages/db/prisma/schema.prisma
  - packages/db/src/queries.js
depends: [db]
---

## What this builds

A new Prisma model plus the query helpers to read and write it. This is the foundation for any feature that stores data.

## Files created

| File | Purpose |
|------|---------|
| `packages/db/prisma/schema.prisma` | The new model definition |
| `packages/db/src/queries.js` | Query helpers for the new model |

## Patterns to follow

- Every model includes `id String @id @default(cuid())`, `createdAt DateTime @default(now())`, and `updatedAt DateTime @updatedAt`.
- If the data belongs to a signed-in user, relate it to `User` with `onDelete: Cascade` (or `SetNull` when optional).
- Add indexes on fields you query by (`@@index([...])`).
- Add query helpers to `packages/db/src/queries.js` — start with `findAll`, `findById`, `create`; add `update`/`delete` when needed.
- Do not call `prisma.*` directly in pages or Server Actions — use the query helpers.
- After any schema change: `pnpm db:generate` then `pnpm db:migrate`.

## Prompt to paste

```text
Add a new Prisma model for <entity> to packages/db/prisma/schema.prisma.

Read CLAUDE.md first, then:
1. Define the model with id, createdAt, and updatedAt; relate it to User if it belongs to a user.
2. Add query helpers (findAll, findById, create, update, delete) to packages/db/src/queries.js.
3. Run pnpm db:generate and pnpm db:migrate.
4. Add a test near the changed code.
```
