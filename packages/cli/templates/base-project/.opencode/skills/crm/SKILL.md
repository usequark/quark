---
name: crm
description: Build a CRM, sales pipeline, or contact management system on Quark. Use when the user wants CRM, pipeline, deals, contacts, companies, or leads.
---

# CRM Skill

Build a user-specific CRM / sales pipeline on Quark's infrastructure. This skill gives you the domain context, the Quark framework patterns, and the end-result shape. You generate the code that fits the user's exact requirements.

## Context

A CRM manages relationships with companies and contacts, and tracks deals through a sales pipeline. The core entities and concerns:

- **Company** — an organization you sell to.
- **Contact** — a person at a company.
- **Deal** — a sales opportunity with a value, stage, and expected close.
- **Pipeline stages** — a configurable stage list (key, label, color, probability, next).
- **Metrics** — pipeline summary, company metrics, expected value.
- **Activity** — notes, calls, and follow-ups on companies/contacts/deals.

## Framework context (build on Quark)

- **Models** live in `packages/db/prisma/schema.prisma`. Every model needs `id`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`. After changes: `pnpm db:generate && pnpm db:migrate`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly in pages/actions.
- **API routes** live in `apps/web/src/app/api/<resource>/`. Guard with `requireRole`, validate with Zod via `validateBody`, wrap mutations in `withCsrfProtection`. Follow `apps/web/src/app/api/users/route.js` as the reference shape.
- **Server Actions** (preferred for mutations) use `"use server"`, Zod validation, and `AppError`/`ValidationError` from `@techstream/quark-core/errors`.
- **Admin views** live under `apps/web/src/app/admin/` using the neutral admin shell patterns (`_patterns/Dashboard.js`, `_patterns/ActionForm.js`).
- **Auth** via `getCurrentSession` from `@techstream/quark-core`.

## Workflow

1. Read `CLAUDE.md` and `MAIN.md` for project conventions.
2. Clarify the user's requirements: pipeline stages, deal fields, metrics.
3. Design the Prisma models (Company, Contact, Deal) and add query helpers.
4. Build the CRUD endpoint(s) with auth + Zod validation.
5. Add pipeline-stage config and metrics query helpers.
6. Add admin views (pipeline board, deal forms) if required.
7. Add tests near the changed code.

## Example model

```prisma
model Company {
  id        String    @id @default(cuid())
  name      String
  website   String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  contacts  Contact[]
  deals     Deal[]
}

model Contact {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  name      String
  email     String?
  phone     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Deal {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  title     String
  value     Decimal  @default(0)
  stage     String   @default("lead")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Example validation schema

```js
const createDealSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().min(1).max(200),
  value: z.coerce.number().nonnegative(),
  stage: z.string().min(1),
});
```

## Example test pattern

```js
import { test } from "node:test";
import assert from "node:assert";

test("pipeline summary totals deal value by stage", async () => {
  // arrange → act → assert
});
```

## End result

A working CRM where users can manage companies, contacts, and deals through a configurable pipeline — with the models, endpoints, metrics, and admin views following Quark conventions.

## Reference

A full reference implementation is archived at `reference/verticals/crm/`. Study it for the complete model set, pipeline config, and metrics logic, then adapt to the user's requirements.
