# Quark Monorepo - Contributor Guide

> For app developers building with Quark: see `CLAUDE.md` in your scaffolded project.
> For the full contributor reference: see `AGENTS.md` at the monorepo root.

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
│   ├── cli/          # @usequark/quark-create-app (published to npm)
│   ├── core/         # @usequark/quark-core (published to npm)
│   ├── db/           # Prisma schema + client + queries
│   ├── config/       # Environment validation + config loading
│   ├── ui/           # Shared UI components (scaffold template)
│   └── jobs/         # BullMQ job type definitions (scaffold template)
└── docs/             # Architecture, API, roadmap docs
```

**Published:** `@usequark/quark-core`, `@usequark/quark-create-app`
**Scaffolded (never published):** `config`, `db`, `ui`, `jobs`

## Non-Negotiable Rules

- **ESM only** - `import`/`export`. Never `require()` or `module.exports`.
- **No authored TypeScript** - `.js` and `.jsx` files only. Generated code may emit typed artifacts, but repo code should not add `.ts` or `.tsx` sources.
- **Biome** - all formatting and linting. No ESLint, no Prettier.
- **Zod** - all Server Actions and API routes. No exceptions.
- **AppError / ValidationError** from `@usequark/quark-core/errors` in app/runtime code. Native `Error` is acceptable in library, bootstrap, CLI, and test code.
- **createLogger(name)** from `@usequark/quark-core` in app/runtime code. Console output is acceptable in bootstrap, CLI, and test code.
- **DB models** - always include `createdAt` and `updatedAt`.
- **Tests** - co-located `*.test.js`, `node --test`. Postgres + Redis required.

## UI & Design System

Import from `@usequark/quark-ui` in the monorepo or `@<scope>/ui` in scaffolded projects - never from `@/components/ui/*`.

Available exports: `Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox`, `Badge`, `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Skeleton`, `ErrorBanner`, `Footer`, `Navbar`/`MobileNavbar`, `RichText`, `QuarkLogo` *(server)*, `Dialog` *(client)*, `Toast`/`useToast` *(client)*, `ThemeProvider`/`useTheme` *(client)*.

For public-page references, inspect `apps/web/src/app/page.js` and `packages/ui/README.md` before creating bespoke layout primitives. Prefer extending the shared package with `className` or local package edits first.

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
pnpm --filter @usequark/quark-create-app sync-templates        # Sync scaffold templates
pnpm --filter @usequark/quark-create-app sync-templates:check  # Check for drift
```

## Template Sync (CRITICAL)

`packages/cli/templates/` is generated from monorepo source - never edit manually (except `TEMPLATE_ONLY` files). After changing any source file in `apps/web/`, `apps/worker/`, `packages/db/`, `packages/config/`, `packages/ui/`, or `packages/jobs/`:

```bash
pnpm --filter @usequark/quark-create-app sync-templates
```

## Release Workflow

1. `pnpm changeset` - create a changeset file (interactive)
2. Commit code + changeset file, open PR
3. CI runs lint + test + build + changeset-check
4. Merge to `main` → CI auto-opens a "chore: version packages" PR
5. Review + merge → publishes to npm + creates GitHub Release

**Never run `pnpm changeset version` locally.** CI does this automatically.

**Published packages only:** `@usequark/quark-core` and `@usequark/quark-create-app`.

