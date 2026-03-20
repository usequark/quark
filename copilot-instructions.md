# Quark Monorepo — Contributor Guide

> For app developers building with Quark: see `CLAUDE.md` in your scaffolded project.
> For the full contributor reference: see `CLAUDE.md` at the monorepo root.

## Quick Setup

```bash
pnpm install
docker compose up -d     # PostgreSQL, Redis, Mailpit
pnpm db:generate         # Generate Prisma client
pnpm dev                 # Start web + worker
```

## Project Structure

```
quark/
├── apps/
│   ├── web/          # Next.js 16 reference app (App Router, Server Actions)
│   └── worker/       # BullMQ background worker
├── packages/
│   ├── cli/          # @techstream/quark-create-app (published to npm)
│   ├── core/         # @techstream/quark-core (published to npm)
│   ├── db/           # Prisma schema + client + queries
│   ├── config/       # Environment validation + config loading
│   ├── ui/           # Shared UI components (scaffold template)
│   └── jobs/         # BullMQ job type definitions (scaffold template)
└── docs/             # Architecture, API, roadmap docs
```

**Published:** `@techstream/quark-core`, `@techstream/quark-create-app`
**Scaffolded (never published):** `config`, `db`, `ui`, `jobs`

## Non-Negotiable Rules

- **ESM only** — `import`/`export`. Never `require()` or `module.exports`.
- **No TypeScript** — `.js` and `.jsx` files only.
- **Biome** — all formatting and linting. No ESLint, no Prettier.
- **Zod** — all Server Actions and API routes. No exceptions.
- **AppError / ValidationError** from `@techstream/quark-core/errors`. Never `throw new Error()`.
- **createLogger(name)** from `@techstream/quark-core`. No `console.log` or `console.error`.
- **DB models** — always include `createdAt` and `updatedAt`.
- **Tests** — co-located `*.test.js`, `node --test`. Postgres + Redis required.

## Commands

```bash
pnpm dev                          # Start web + worker
pnpm build                        # Build all packages
pnpm test                         # Run all tests (requires Docker)
pnpm lint                         # Biome lint + format check
pnpm db:generate                  # Regenerate Prisma client
pnpm db:migrate                   # Apply migrations
pnpm db:studio                    # Open Prisma Studio
pnpm changeset                    # Create a changeset (interactive)
pnpm --filter @techstream/quark-create-app sync-templates        # Sync scaffold templates
pnpm --filter @techstream/quark-create-app sync-templates:check  # Check for drift
```

## Template Sync (CRITICAL)

`packages/cli/templates/` is generated from monorepo source — never edit manually (except `TEMPLATE_ONLY` files). After changing any source file in `apps/web/`, `apps/worker/`, `packages/db/`, `packages/config/`, `packages/ui/`, or `packages/jobs/`:

```bash
pnpm --filter @techstream/quark-create-app sync-templates
```

## Release Workflow

1. `pnpm changeset` — create a changeset file (interactive)
2. Commit code + changeset file, open PR
3. CI runs lint + test + build + changeset-check
4. Merge to `main` → CI auto-opens a "chore: version packages" PR
5. Review + merge → publishes to npm + creates GitHub Release

**Never run `pnpm changeset version` locally.** CI does this automatically.

**Published packages only:** `@techstream/quark-core` and `@techstream/quark-create-app`.

