---
name: add-endpoint
description: Add a REST CRUD endpoint on Quark. Use when the user wants an API route, endpoint, or REST resource.
---

# Add Endpoint Skill

Add a REST CRUD endpoint for an existing model: list/create on the collection route, and read/update/delete on the `[id]` route.

## Framework context (build on Quark)

- **API routes** live in `apps/web/src/app/api/<resource>/`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly.
- **Auth** via `requireRole` from `@/lib/auth-middleware`; **validation** via Zod `validateBody`; **CSRF** via `withCsrfProtection` from `@usequark/quark-core`.

## Workflow

1. Create `apps/web/src/app/api/<resource>/route.js` (GET list + POST create).
2. Create `apps/web/src/app/api/<resource>/[id]/route.js` (GET read + PATCH update + DELETE).
3. Add a test near the changed code.

## Patterns to follow

- Use `NextResponse` from `next/server` and `handleError` from `../error-handler`.
- Guard with `requireRole("admin")` (or the appropriate role).
- Validate the body with Zod via `validateBody(request, schema)`.
- Wrap mutations in `withCsrfProtection`.
- Return `404` when a record is not found; `201` on create.
- Follow `apps/web/src/app/api/users/route.js` and `apps/web/src/app/api/users/[id]/route.js` as reference.
