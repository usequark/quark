---
name: cms
description: Build a content management system on Quark. Use when the user wants CMS, content, pages, blog, articles, or editorial workflows.
---

# CMS Skill

Build a user-specific content management system on Quark's infrastructure. This skill gives you the domain context, the Quark framework patterns, and the end-result shape. You generate the code that fits the user's exact requirements.

## Context

A CMS manages structured content with an editorial workflow. The core entities and concerns:

- **Content** — pages, posts, articles, or structured content types.
- **Media** — uploaded assets (images, files) referenced by content.
- **Editorial flow** — status transitions (draft → published → archived), preview.
- **Public rendering** — a `[slug]` route that renders published content to the public site.
- **SEO** — metadata, sitemap, robots for published content.

## Framework context (build on Quark)

- **Models** live in `packages/db/prisma/schema.prisma`. Every model needs `id`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`. After changes: `pnpm db:generate && pnpm db:migrate`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly in pages/actions.
- **API routes** live in `apps/web/src/app/api/<resource>/`. Guard with `requireRole`, validate with Zod via `validateBody`, wrap mutations in `withCsrfProtection`. Follow `apps/web/src/app/api/users/route.js` as the reference shape.
- **Media uploads** follow the existing `apps/web/src/app/api/files/` pattern.
- **Public rendering** uses a `[slug]` route; published content only, with SEO metadata.
- **Admin views** live under `apps/web/src/app/admin/` using the neutral admin shell patterns.
- **Auth** via `getCurrentSession` from `@techstream/quark-core`.

## Workflow

1. Read `CLAUDE.md` and `MAIN.md` for project conventions.
2. Clarify the user's requirements: content types, editorial flow, public rendering.
3. Design the Prisma models (content + media) and add query helpers.
4. Build the CRUD endpoint(s) with auth + Zod validation.
5. Add the editorial flow (status transitions, preview).
6. Add public rendering (`[slug]` route) with SEO metadata.
7. Add tests near the changed code.

## End result

A working CMS where editors can create, review, and publish content that renders on the public site — with the models, endpoints, editorial flow, and public routes following Quark conventions.

## Reference

A full reference implementation is archived at `reference/verticals/cms/` and `reference/verticals/cms-routes/`. Study it for the complete content model, editorial flow, and public rendering, then adapt to the user's requirements.
