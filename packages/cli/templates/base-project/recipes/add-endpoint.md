---
name: Add a CRUD endpoint
feature: endpoint
files:
  - apps/web/src/app/api/<feature>/route.js
  - apps/web/src/app/api/<feature>/[id]/route.js
depends: [db]
---

## What this builds

A REST CRUD endpoint for an existing model: list/create on the collection route, and read/update/delete on the `[id]` route.

## Files created

| File | Purpose |
|------|---------|
| `apps/web/src/app/api/<feature>/route.js` | `GET` (list) + `POST` (create) |
| `apps/web/src/app/api/<feature>/[id]/route.js` | `GET` (read) + `PATCH` (update) + `DELETE` |

## Patterns to follow

- Use `NextResponse` from `next/server` and `handleError` from `../error-handler`.
- Guard with `requireRole("admin")` (or the appropriate role) from `@/lib/auth-middleware`.
- Validate the body with Zod via `validateBody(request, schema)` from `@techstream/quark-core`.
- Wrap mutations in `withCsrfProtection` from `@techstream/quark-core`.
- Use query helpers from `@yourapp/db` — never `prisma.*` directly.
- Return `404` when a record is not found; `201` on create.
- Follow the existing `apps/web/src/app/api/users/route.js` and `apps/web/src/app/api/users/[id]/route.js` as reference.

## Prompt to paste

```text
Add a CRUD endpoint for the <model> model.

Read CLAUDE.md first, then:
1. Create apps/web/src/app/api/<feature>/route.js with GET (list) and POST (create).
2. Create apps/web/src/app/api/<feature>/[id]/route.js with GET, PATCH, and DELETE.
3. Guard with requireRole, validate with Zod, wrap mutations in withCsrfProtection.
4. Use query helpers from @yourapp/db, not prisma directly.
5. Add a test near the changed code.
```
