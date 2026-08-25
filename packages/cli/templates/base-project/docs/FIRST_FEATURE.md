# First Feature

Use this guide when you are ready to add the first real feature to your project.

## Goal

Prove the full workflow once:

1. add a Prisma model
2. run the migration
3. add query helpers
4. build a page or mutation flow
5. add a test near the changed code

## 1. Add the model

Edit `packages/db/prisma/schema.prisma`.

Every model should include:

- `id String @id @default(cuid())`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`

If the new data belongs to a signed-in user, relate it to `User`.

## 2. Generate and migrate

```bash
pnpm db:generate
pnpm db:migrate
```

## 3. Add query helpers

Edit `packages/db/src/queries.js`.

Start with the smallest useful surface:

- `findAll`
- `findById`
- `create`

Add `update` and `delete` when the feature actually needs them.

## 4. Build the web flow

Use `apps/web/src/app/` for the first route.

Typical first files:

- `apps/web/src/app/<feature>/page.js`
- `apps/web/src/app/<feature>/_actions/*.js` for Server Actions
- `apps/web/src/app/api/<feature>/route.js` if this feature needs an API surface

If the project includes `ui`, use components from `@yourapp/ui`.

## 5. Add one test

Start in the layer you changed first:

- query helper test
- route test
- form helper test

Do not wait for a perfect end-to-end suite before writing the first useful test.

## Optional next step

If the feature needs more infrastructure, add it only when necessary:

- `ui` for reusable components
- `jobs` for async work
- `cms` for editorial content workflows
