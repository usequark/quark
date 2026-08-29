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
- **Admin views** live under `apps/web/src/app/admin/` (see the admin-dashboard skill).
- **Auth** via `getCurrentSession` from `@techstream/quark-core`.

## Workflow

1. Read `CLAUDE.md` and `MAIN.md` for project conventions.
2. Clarify the user's requirements: content types, editorial flow, public rendering.
3. Design the Prisma models (content + media) and add query helpers.
4. Build the CRUD endpoint(s) with auth + Zod validation.
5. Add the editorial flow (status transitions, preview).
6. Add public rendering (`[slug]` route) with SEO metadata.
7. Add tests near the changed code.

## Example model

A CMS manages content (pages/posts) plus a media library:

```prisma
enum ContentStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Page {
  id          String        @id @default(cuid())
  title       String
  slug        String        @unique
  body        String        @db.Text
  excerpt     String?
  status      ContentStatus @default(DRAFT)
  publishedAt DateTime?
  authorId    String
  author      User          @relation(fields: [authorId], references: [id])
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([status])
  @@index([slug])
}

model MediaAsset {
  id        String   @id @default(cuid())
  url       String
  alt       String?
  mimeType  String
  size      Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Editorial flow

Content follows a status lifecycle: **draft → published → archived**. Enforce transitions in the publish/archive actions, set `publishedAt` on publish, and render only `PUBLISHED` content on the public `[slug]` route. Media uploads follow the existing `apps/web/src/app/api/files/` pattern.

## Example validation schema

```js
const createPageSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  body: z.string(),
  excerpt: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});
```

## Example test pattern

```js
import { test } from "node:test";
import assert from "node:assert";

test("published page renders on the public slug route", async () => {
  // arrange → act → assert
});
```

## End result

A working CMS where editors can create, review, and publish content that renders on the public site — with the models, endpoints, editorial flow, and public routes following Quark conventions.


