---
name: admin-dashboard
description: Build an admin dashboard or internal operations area on Quark. Use when the user wants an admin panel, back office, CRUD screens, or an internal tool for managing data.
---

# Admin Dashboard Skill

Build an admin dashboard on Quark's infrastructure. This skill gives you the framework patterns and the end-result shape. You generate the code that fits the user's exact requirements.

## Context

An admin dashboard is an authenticated operations surface for managing application data. Core concerns:

- **Access control** — staff-only routes, role checks, separation from public pages.
- **Entity management** — list, create, edit, delete (CRUD) for each domain model.
- **Overview** — decision-relevant metrics (counts, totals, statuses), not raw data dumps.
- **Audit trail** — record who changed what, when.

## Framework context (build on Quark)

- **Routes** live in `apps/web/src/app/admin/<entity>/`. Guard them with `requireRole` from `apps/web/src/lib/auth-middleware.js`.
- **Models** live in `packages/db/prisma/schema.prisma`. Every model needs `id`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`. After changes: `pnpm db:generate && pnpm db:migrate`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly in pages/actions.
- **Server Actions** are `"use server"`, validate with Zod, and use `createLogger()` from the core package.
- **API routes** (when needed) live in `apps/web/src/app/api/<resource>/`. Validate with Zod via `validateBody`, wrap mutations in `withCsrfProtection`. Follow `apps/web/src/app/api/users/route.js` as the reference shape.
- **UI components** import from the shared UI package (`@scope/ui`). Never deep-import.

## CRUD page pattern

For each managed entity:

1. `apps/web/src/app/admin/<entity>/page.js` — list view: table of records with pagination, plus links to edit/create.
2. `apps/web/src/app/admin/<entity>/new/page.js` — creation form posting to a Server Action.
3. `apps/web/src/app/admin/<entity>/[id]/page.js` — detail/edit form; delete action with confirmation.
4. `apps/web/src/app/admin/<entity>/_actions/<entity>.js` — `"use server"` actions: validate input with Zod, write through query helpers, log with `createLogger()`.
5. Sibling `loading.js` for every async page that fetches from the database, using `<Skeleton>`.
6. `export const metadata` (title + description) on every page.

## Dashboard pattern

For overview screens, prefer metric cards over raw tables:

1. Pick 3-6 decision-relevant values for the domain (counts, totals, recent activity).
2. Load them in Server Actions through query helpers.
3. Render as cards with a sibling `loading.js`.

## Audit logging

Write an `auditLog` record for admin mutations (action, entity, entityId, metadata) so changes are traceable. See `packages/db/prisma/schema.prisma` for the model.

## Non-goals

- Do not expose admin routes publicly or skip role guards.
- Do not bypass query helpers with direct Prisma calls in UI code.
