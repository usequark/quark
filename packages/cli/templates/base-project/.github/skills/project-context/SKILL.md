---
name: project-context
description: Project-specific context and conventions. This skill evolves with your project - update it as your architecture grows.
---

# Project Context

## Overview

This is a Quark-based full-stack JavaScript application.

| Property | Value |
|---|---|
| **Scope** | `@__QUARK_SCOPE__` |
| **Framework** | Quark (scaffolded from `@techstream/quark-create-app`) |
| **Scaffolded** | __QUARK_SCAFFOLD_DATE__ |

## Project Structure

```
__QUARK_PROJECT_NAME__/
├── apps/
│   ├── web/          # Next.js (App Router, Server Actions)
__QUARK_OPTIONAL_APPS__├── packages/
│   ├── db/           # Prisma schema, client, queries
│   ├── config/       # Environment validation & shared config
__QUARK_OPTIONAL_PACKAGES__├── docker-compose.yml
├── .env              # Local environment (git-ignored)
└── .env.example      # Template for environment variables
```

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, ES Modules |
| Package manager | pnpm (workspaces) |
| Monorepo | Turborepo |
| Web | Next.js 16 (App Router) |
| Database | PostgreSQL 16 + Prisma 7 |
| Queue | BullMQ + Redis 7 |
| Auth | NextAuth v5 |
| Validation | Zod 4 |
| UI | Tailwind CSS + `@__QUARK_SCOPE__/ui` components |
| Email | Nodemailer |
| Linting | Biome |
| Testing | Node.js built-in test runner |

## Coding Conventions

- **ESM only** - use `import`/`export`, never `require`.
- **No authored TypeScript** - plain `.js` and `.jsx` files. Generated code may emit typed artifacts, but project code should not add `.ts` or `.tsx` sources.
- **Imports:** Use `@techstream/quark-core` for published utilities. Use `@__QUARK_SCOPE__/*` for local packages (db, config, ui, jobs).
- **Tests:** Co-located `*.test.js` files, run with `node --test`.
- **Validation:** Zod schemas for all Server Actions and API routes.
- **Errors:** Use `AppError` / `ValidationError` from `@techstream/quark-core/errors` in app/runtime code. Native `Error` is acceptable in library, bootstrap, CLI, and test code.
- **Logging:** Use `createLogger(name)` from `@techstream/quark-core` in app/runtime code. Console output is acceptable in bootstrap, CLI, and test code.
- **Database models:** Always include `createdAt`/`updatedAt`.
- **Environment:** All env vars validated in `packages/config/src/validate-env.js`.
- **Analytics:** Optional Umami support lives in `apps/web/src/lib/analytics/*`. The public env contract uses only `NEXT_PUBLIC_UMAMI_URL`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, and `NEXT_PUBLIC_UMAMI_REPLAY_ENABLED`; replay uses a local rrweb recorder, and dormant helpers exist for dashboard-generated Umami Links, Pixels, and marketing-email snippets.

## Common Commands

```bash
pnpm dev              # Start all apps in dev mode
pnpm build            # Build everything
pnpm test             # Run all tests
pnpm lint             # Lint with Biome
pnpm db:generate      # Regenerate Prisma client
pnpm db:push          # Push schema changes
pnpm db:migrate       # Run database migrations
docker compose up -d  # Start infrastructure
```

## Key Files to Know

- `packages/db/prisma/schema.prisma` - Database schema (edit this to add models)
- `packages/db/src/queries.js` - Database query functions
- `packages/config/src/validate-env.js` - Environment variable validation
- `apps/web/src/app/` - Next.js App Router pages and API routes
- `apps/web/src/lib/auth.js` - Authentication configuration
- `apps/web/src/lib/analytics/umami-config.js` - Optional Umami URL and replay gating
- `apps/worker/src/handlers/` - Background job handlers

## Updating Quark Core

```bash
npx @techstream/quark-create-app update   # Update core infrastructure
pnpm update @techstream/quark-core        # Or update directly
```

---

## Maintaining This Skill

> **Important:** When you make changes that affect this project's architecture,
> conventions, or structure - such as adding new packages, models, API patterns,
> environment variables, deployment targets, or team conventions - **update this
> skill file** to reflect those changes. This ensures future AI interactions
> always have accurate, up-to-date context.
>
> Examples of when to update this file:
> - Adding a new Prisma model or database table
> - Introducing a new API route pattern or middleware
> - Adding or removing a workspace package
> - Changing deployment infrastructure or CI/CD steps
> - Establishing new coding conventions or architectural decisions
> - Adding third-party integrations or services
