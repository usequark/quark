---
name: add-dashboard
description: Add a decision dashboard to the admin on Quark. Use when the user wants a dashboard, metrics, or admin overview page.
---

# Add Dashboard Skill

Add a decision dashboard in admin: metric cards showing decision-relevant values for a domain, backed by query helpers and a Server Action.

## Framework context (build on Quark)

- **Admin** is an operations shell — show decision-relevant values (counts, totals, statuses), not raw CRUD tables.
- **Server Actions** are `"use server"`, validate with Zod, and use `createLogger()`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly.

## Workflow

1. Create `apps/web/src/app/admin/<feature>/page.js` with metric cards.
2. Create `apps/web/src/app/admin/<feature>/_actions/<feature>.js` (Server Actions that load the metrics).
3. Add a sibling `loading.js` using `<Skeleton>`.
4. Add `export const metadata` (title + description).

## Patterns to follow

- Metric cards show decision-relevant values (counts, totals, statuses), not raw tables.
- Server Actions are `"use server"`, validate with Zod, and use `createLogger()`.
- Every async page that fetches from the database needs a sibling `loading.js` using `<Skeleton>`.
- Add `export const metadata` (title + description) to the page.
