---
name: Add a decision dashboard
feature: dashboard
files:
  - apps/web/src/app/admin/<feature>/page.js
  - apps/web/src/app/admin/<feature>/_actions/<feature>.js
depends: [db, admin]
---

## What this builds

A decision dashboard in admin: metric cards showing decision-relevant values for a domain, backed by query helpers and a Server Action.

## Files created

| File | Purpose |
|------|---------|
| `apps/web/src/app/admin/<feature>/page.js` | The dashboard page with metric cards |
| `apps/web/src/app/admin/<feature>/_actions/<feature>.js` | Server Actions that load the metrics |

## Patterns to follow

- Admin is an **operations shell** — show decision-relevant values (counts, totals, statuses), not raw CRUD tables.
- Use the metric-card pattern from `apps/web/src/app/admin/_patterns/Dashboard.js`.
- Server Actions are `"use server"`, validate with Zod, and use `createLogger()`.
- Use query helpers from `@yourapp/db` — never `prisma.*` directly.
- Every async page that fetches from the database needs a sibling `loading.js` using `<Skeleton>`.
- Add `export const metadata` (title + description) to the page.

## Prompt to paste

```text
Add a decision dashboard for <feature> to admin.

Read CLAUDE.md first, then:
1. Create apps/web/src/app/admin/<feature>/page.js with metric cards for the key decision values.
2. Create apps/web/src/app/admin/<feature>/_actions/<feature>.js with Server Actions that load the metrics.
3. Use the Dashboard pattern, query helpers from @yourapp/db, and a loading.js sibling.
4. Add a test near the changed code.
```
