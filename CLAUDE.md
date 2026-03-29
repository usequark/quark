# Quark — Contributor Guide

> For app developers building with Quark: see `CLAUDE.md` in your scaffolded project.

## Quick Setup

```bash
pnpm install
docker compose up -d     # PostgreSQL, Redis, Mailpit
pnpm db:generate         # Generate Prisma client
pnpm dev                 # Start all apps (web + worker)
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
│   ├── ui/           # Shared UI components (Tailwind, scaffold template)
│   └── jobs/         # BullMQ job type definitions (scaffold template)
├── docs/             # Architecture, API, roadmap docs
└── packages/cli/templates/  # Generated scaffold templates — see Template Sync
```

**Published to npm:** `@techstream/quark-core`, `@techstream/quark-create-app`
**Scaffolded (local-only, never published):** `config`, `db`, `ui`, `jobs`, `admin`

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start all apps in development |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests (requires Postgres + Redis) |
| `pnpm lint` | Lint with Biome |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm changeset` | Create a changeset (interactive) |
| `pnpm --filter @techstream/quark-create-app sync-templates` | Sync scaffold templates from monorepo source |
| `pnpm --filter @techstream/quark-create-app sync-templates:check` | Check for template drift without modifying |

## Coding Conventions

- **ESM only** — `import`/`export`. Never `require()` or `module.exports`.
- **No TypeScript** — `.js` and `.jsx` files only.
- **Linting** — Biome for all formatting and linting. No ESLint, no Prettier.
- **Validation** — Zod for all Server Actions and API routes. No exceptions.
- **Errors** — `AppError` / `ValidationError` from `@techstream/quark-core/errors`. Never `throw new Error()` in app code.
- **Logging** — `createLogger(name)` from `@techstream/quark-core`. Never `console.log` or `console.error` in production code.
- **Metrics** — `metrics` singleton from `@techstream/quark-core` for counters, gauges, histograms.
- **DB models** — Always include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` on every Prisma model.
- **Tests** — Co-located `*.test.js` files, run with `node --test`. Postgres + Redis required.

## UI & Design System

The `packages/ui` directory contains Tailwind-only, dependency-free Server Component-safe primitives.

Available exports: `Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox`, `Badge`, `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Skeleton`, `QuarkLogo` (server), `Dialog` (client), `Toast`/`useToast` (client), `ThemeProvider`/`useTheme` (client).

All components accept `className` for Tailwind overrides. Import from `@techstream/quark-ui` (monorepo) or `@<scope>/ui` (scaffolded projects) — never deep-import (`@/components/ui/*`).

## Template Sync

`packages/cli/templates/` is **generated from monorepo source** — never edited manually (except `TEMPLATE_ONLY` files).

After changing any source file in `apps/web/`, `apps/worker/`, `packages/db/`, `packages/config/`, `packages/ui/`, or `packages/jobs/`:

```bash
pnpm --filter @techstream/quark-create-app sync-templates
```

CI checks for template drift on every push and fails if templates are stale.

**`TEMPLATE_ONLY` files** (in `sync-templates.js`) are generation templates containing `__QUARK_*__` placeholders (e.g. `CLAUDE.md`, `.cursor/rules/quark.mdc`, `SKILL.md`), scaffold-specific configs, and GitHub workflow templates. These are **never overwritten** by the sync.

## Release Workflow

1. Make changes on a branch
2. Run `pnpm changeset` (interactive) to create a changeset file
3. Commit code + changeset, open PR
4. CI runs lint + test + build + changeset-check
5. Merge to `main`
6. Release workflow auto-opens a "chore: version packages" PR
7. Review + merge → publishes to npm + creates GitHub Release

**CRITICAL:** Never run `pnpm changeset version` locally. CI does this automatically.

**Published packages only:** `@techstream/quark-core` and `@techstream/quark-create-app`. Scaffolded packages are excluded from versioning.

## Testing

```bash
docker compose up -d  # Required: Postgres 16 + Redis 7
pnpm test             # Run all tests
```

Test utilities and factories live in `packages/core/src/testing/`.

## Architecture Decisions

- **Why no TypeScript?** Lower barrier to contribution; Zod provides runtime type safety at all system boundaries.
- **Why scaffolded (not published) for ui/db/config/jobs?** Projects own their data layer and UI components. No framework-level coupling after scaffold.
- **Why Railway?** Zero-config Postgres + Redis + env injection + tag-based promotion. `railway.json` per app.
- **Why BullMQ?** Redis-backed, production-grade queue with retries, deduplication, priorities, and built-in metrics hooks.
