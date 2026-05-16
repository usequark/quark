# @yourscope/admin

Scaffolded admin utilities for your Quark project.

This package supports the `/admin` routes that Quark scaffolds into `apps/web/src/app/admin/`. The code is local to your project, so you can tune it freely without waiting on framework updates.

## Use this package when

- internal users need CRUD over Prisma models
- you want a fast internal back office without building every table and form by hand
- you want project-owned admin code rather than a hosted admin dependency

## What it owns

- `src/config.js` - labels, page size, read-only models, hidden fields
- `src/introspect.js` - runtime model discovery
- `src/field-map.js` - field-to-input mapping rules
- `src/query.js` - admin query helpers

The actual admin pages live in:

- `apps/web/src/app/admin/`

## First files to edit in a scaffolded project

1. `packages/admin/src/config.js` - tune labels, read-only models, and hidden fields
2. `apps/web/src/app/admin/` - adjust layouts, dashboard content, or route-specific UI
3. `packages/db/prisma/schema.prisma` - add or change the models the admin reads

## Common customizations

- hide sensitive fields with `hiddenFields`
- mark models as read-only
- rename model labels for internal teams
- adjust pagination defaults

## How it works

The admin package inspects your Prisma models at runtime and maps common field types to sensible form and table behavior.

That means the fastest way to change what appears in admin is usually:

1. update the Prisma schema
2. update `adminConfig`
3. refresh the admin UI

## Important boundary

This package is for **internal admin workflows**.

Your public product pages, API routes, and customer-facing flows should still live in `apps/web/src/app/` and use your normal domain query helpers.
