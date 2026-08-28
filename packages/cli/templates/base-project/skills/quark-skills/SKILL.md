---
name: quark-skills
description: Index of every skill bundled with this Quark project - what each skill is for and when to load it. Start here when deciding which skill applies to a task.
---

# Quark Skills Index

Every skill below ships with this project and is always available. Skills are abstract and domain-neutral: they describe framework patterns and workflows, not a specific business. Load the relevant `SKILL.md` before starting work in its area.

## Core workflow skills

| Skill | Path | Purpose |
|---|---|---|
| add-model | `add-model/SKILL.md` | Add a new Prisma model, query helpers, and tests to the db package. |
| add-endpoint | `add-endpoint/SKILL.md` | Add an API route (or Server Action) with Zod validation, CSRF, and role guards. |
| add-dashboard | `add-dashboard/SKILL.md` | Add a metrics/overview dashboard page with metric cards and loading states. |
| admin-dashboard | `admin-dashboard/SKILL.md` | Build a full admin/back-office area: guarded routes, CRUD screens, audit logging. |

## Domain starters

These teach the AI to build a complete vertical on demand. No starter code is scaffolded - the AI generates it from the skill.

| Skill | Path | Purpose |
|---|---|---|
| bookings | `bookings/SKILL.md` | Booking/reservation/appointment/scheduling systems. |
| crm | `crm/SKILL.md` | Contact/pipeline/customer relationship systems. |
| cms | `cms/SKILL.md` | Content modeling, authoring, and publishing systems. |
| ai | `ai/SKILL.md` | AI assistant features (chat, completions) on app data. |
| ecommerce | `ecommerce/SKILL.md` | Product catalog, cart, checkout, orders, inventory. Sub-skills: `ecommerce-catalog`, `ecommerce-cart`, `ecommerce-checkout`. |

## How to use skills

1. Match the user's request to a skill above; read its `SKILL.md` first.
2. Skills assume the Quark conventions: Zod-validated actions/routes, query helpers in `packages/db/src/queries.js`, shared UI imports, `createLogger()` logging, models with `createdAt`/`updatedAt`.
3. If no skill matches, follow `CLAUDE.md` / project context and the reference patterns in `apps/web/src/app/api/users/route.js` and `apps/web/src/app/example-page/page.js`.
