# @yourscope/cms

Scaffolded content-management helpers for your Quark project.

Use this package when your project needs editorial workflows, managed pages, or a media-aware content area that still lives inside your codebase and Prisma schema.

## Use this package when

- content types belong in your app database, not a separate SaaS CMS
- editors need structured content under `/admin/cms`
- you want schema-driven content with project-owned routes and logic

## What it owns

- `src/config.js` - managed content types and media rules
- `src/content-query.js` - CMS-facing data access helpers
- `src/page-builder.js` - page content helpers
- `src/slug.js` and `src/status.js` - content lifecycle helpers

The paired CMS routes live in:

- `apps/web/src/app/admin/cms/`

## First files to edit in a scaffolded project

1. `packages/cms/src/config.js` - choose which Prisma models appear in CMS
2. `packages/db/prisma/schema.prisma` - define or extend the content models
3. `apps/web/src/app/admin/cms/` - adjust the editorial UI if your workflow needs it

## Relationship to the admin package

The CMS builds on the same local-first philosophy as the admin package:

- `admin` is generic CRUD over Prisma models
- `cms` is a content-specific workflow layered on top

If your project only needs internal CRUD, `admin` may be enough.

## Important boundary

The CMS package helps you **manage** content.

You still own how that content is rendered on the public site. Public routes and presentation live in `apps/web/src/app/`.
