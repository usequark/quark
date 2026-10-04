# First Feature Guide

This is the canonical "build something real" walkthrough for a new Quark project.

It assumes the **minimal scaffold** is present (`apps/web`, `packages/db`, `packages/config`) and treats optional packages like `ui`, `jobs`, `admin`, and `cms` as add-ons rather than prerequisites.

## Goal

Add a simple `Task` feature that proves the full workflow:

1. define a Prisma model
2. generate and migrate the database
3. add query helpers
4. render a page in `apps/web`
5. add at least one test

## 1. Add the model

Open `packages/db/prisma/schema.prisma` and add a domain model.

Use the Quark defaults:

- `id String @id @default(cuid())`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`

If the data belongs to a user, relate it to `User` explicitly.

## 2. Generate and migrate

```bash
pnpm db:generate
pnpm db:migrate
```

Use `db:migrate` for real schema changes. Reserve `db:push` for throwaway local experiments.

## 3. Add query helpers

Open `packages/db/src/queries.js` and add a small query surface for the new model.

Follow the existing pattern:

- keep queries grouped by model
- accept pagination options where list views need them
- return safe data shapes if the result will ever be exposed to clients
- prefer reusable helpers over calling `prisma.task.*` directly inside pages or actions

Typical first helpers:

1. `findAll`
2. `findById`
3. `create`
4. `update`
5. `delete`

## 4. Build the first page

Create a route in `apps/web/src/app/` that uses the query helpers.

For example:

- `apps/web/src/app/tasks/page.js` for the read path
- `apps/web/src/app/tasks/_actions/create-task.js` for a mutation via Server Action

Default to the standard Quark pattern:

- Server Components for reads
- Zod validation at mutation boundaries
- `AppError` / `ValidationError` for failures
- `createLogger()` instead of `console.log`

If your project includes `ui`, build the page with components from `@yourapp/ui`.

## 5. Add a test near the changed code

Add one test that proves the new feature works in the layer you changed first.

Good first choices:

- a query helper test near `packages/db/src/queries.js`
- a pure helper test next to a new utility
- a focused route or form test if that is where the logic lives

Do not start with a huge end-to-end test if a smaller test will prove the behavior.

## 6. Expand from there

Once the first vertical slice works, add optional Quark features when they help:

| Feature | When to add it |
|---|---|
| `ui` | You want local reusable components for forms, tables, and layouts |
| `jobs` | The feature needs async work like email, imports, or cleanup |
| `admin` | Internal users need CRUD over the new Prisma model |
| `cms` | The feature is content-heavy and belongs in editorial workflows |

Add optional features later with:

```bash
npx @usequark/quark-create-app add <feature>
```

## Checklist

- Model added to `schema.prisma`
- `pnpm db:generate` run
- `pnpm db:migrate` run
- Query helpers added
- Page or mutation flow added
- At least one test added

When that is done, you are no longer learning the scaffold - you are building product code.
