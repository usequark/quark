---
name: Add a CMS
feature: cms
files:
  - packages/db/prisma/cms.prisma
  - apps/web/src/app/api/cms/route.js
  - apps/web/src/app/api/cms/[id]/route.js
depends: [db]
---

## What this builds

A generic CMS: a `Page` model plus a CRUD endpoint. This is a lean starting point — you extend it with content types, media, and editorial flows as your product needs them.

## Files created

| File | Purpose |
|------|---------|
| `packages/db/prisma/cms.prisma` | Generic `Page` model (merge into `schema.prisma`) |
| `apps/web/src/app/api/cms/route.js` | `GET` (list) + `POST` (create) |
| `apps/web/src/app/api/cms/[id]/route.js` | `GET` (read) + `PATCH` (update) + `DELETE` |

## Patterns to follow

- Merge `cms.prisma` into `packages/db/prisma/schema.prisma`, then `pnpm db:generate && pnpm db:migrate`.
- Every model includes `id`, `createdAt DateTime @default(now())`, and `updatedAt DateTime @updatedAt`.
- Guard with `requireRole`, validate with Zod via `validateBody`, wrap mutations in `withCsrfProtection`.
- Use query helpers in `packages/db/src/queries.js` — do not call `prisma.*` directly in pages.
- Follow the existing `apps/web/src/app/api/users/route.js` as reference.

## Extension path

The generic starter covers the core. To build a real CMS, extend with:

- **Content types** — add models for posts, articles, or structured content; relate them to `Page` or stand alone.
- **Media library** — add a `MediaAsset` model and a media upload endpoint (see `apps/web/src/app/api/files/`).
- **Editorial flows** — add status transitions (draft → published → archived) and a preview route.
- **Public rendering** — add a `[slug]` route that renders published pages to the public site.

## Prompt to paste

```text
Build the CMS described in recipes/cms.md.

Read CLAUDE.md first, then:
1. Merge packages/db/prisma/cms.prisma into schema.prisma and migrate.
2. Add query helpers for Page to packages/db/src/queries.js.
3. Wire up the CRUD endpoint at apps/web/src/app/api/cms/.
4. Extend with content types, media, and editorial flows per the extension path.
5. Add a test near the changed code.
```
