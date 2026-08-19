---
name: Add a CRM / pipeline
feature: crm
files:
  - packages/db/prisma/crm.prisma
  - apps/web/src/app/api/crm/route.js
  - apps/web/src/app/api/crm/[id]/route.js
depends: [db]
---

## What this builds

A generic CRM / pipeline: `Company`, `Contact`, and `Deal` models plus a CRUD endpoint for deals. This is a lean starting point — you extend it with pipeline stages, configurable labels, and metrics as your product needs them.

## Files created

| File | Purpose |
|------|---------|
| `packages/db/prisma/crm.prisma` | Generic `Company` / `Contact` / `Deal` models (merge into `schema.prisma`) |
| `apps/web/src/app/api/crm/route.js` | `GET` (list) + `POST` (create) |
| `apps/web/src/app/api/crm/[id]/route.js` | `GET` (read) + `PATCH` (update) + `DELETE` |

## Patterns to follow

- Merge `crm.prisma` into `packages/db/prisma/schema.prisma`, then `pnpm db:generate && pnpm db:migrate`.
- Every model includes `id`, `createdAt DateTime @default(now())`, and `updatedAt DateTime @updatedAt`.
- Guard with `requireRole`, validate with Zod via `validateBody`, wrap mutations in `withCsrfProtection`.
- Use query helpers in `packages/db/src/queries.js` — do not call `prisma.*` directly in pages.
- Follow the existing `apps/web/src/app/api/users/route.js` as reference.

## Extension path

The generic starter covers the core. To build a real CRM, extend with:

- **Pipeline stages** — add a configurable stage list (key, label, color, probability, next) stored in `AppConfig`.
- **Metrics** — add pipeline summary and company metrics query helpers (counts, totals, expected value).
- **Contacts & companies** — add CRUD endpoints for `Contact` and `Company`.
- **Admin views** — add a pipeline board and deal forms under `apps/web/src/app/admin/crm/`.

## Prompt to paste

```text
Build the CRM / pipeline described in recipes/crm.md.

Read CLAUDE.md first, then:
1. Merge packages/db/prisma/crm.prisma into schema.prisma and migrate.
2. Add query helpers for Deal, Contact, and Company to packages/db/src/queries.js.
3. Wire up the CRUD endpoint at apps/web/src/app/api/crm/.
4. Extend with pipeline stages and metrics per the extension path.
5. Add a test near the changed code.
```
