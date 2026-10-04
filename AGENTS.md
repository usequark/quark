# Quark - Agent Context

## Non-Negotiable Rules

- **ESM only** - `import`/`export` everywhere. Never `require()` or `module.exports`.
- **No authored TypeScript** - `.js` and `.jsx` files only. Generated code may emit typed artifacts, but repo code should not add `.ts`, `.tsx`, type annotations, or `tsconfig`. Exceptions: scaffold templates (`packages/cli/templates/mobile/`) and the mobile app (`apps/mobile/`) may use `.ts`/`.tsx` when required by the target ecosystem (React Native / Expo).
- **No `throw new Error()` in app/runtime code** - use `AppError` / `ValidationError` from `@usequark/quark-core/errors`. Native `Error` is reserved for library, bootstrap, CLI, and test code.
- **No `console.log/error` in app/runtime code** - use `createLogger(name)` from `@usequark/quark-core`. Console output is reserved for bootstrap, CLI, and test code.
- **Zod required** - all Server Actions and API routes must validate with Zod. No exceptions.
- **Biome only** - no ESLint, no Prettier. Run `pnpm lint` to check.
- **DB models** - every Prisma model must include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.

## Critical Gotchas

### Templates are generated - never edit them directly
`packages/cli/templates/` is auto-generated from monorepo source. Editing files there directly will be overwritten.
After changing source files in `apps/web/`, `apps/worker/`, `packages/db/`, `packages/config/`, `packages/ui/`, or `packages/jobs/`, run:
```bash
pnpm --filter @usequark/quark-create-app sync-templates
```

### Schema trimming
The CLI trims domain models (CRM, CMS, AI, Booking) from the scaffolded Prisma schema by default, keeping only 7 core models. Use `--full-schema` to keep all models. The source schema always contains all models — trimming happens at scaffold time via `trimPrismaSchema()` in `packages/cli/src/index.js`.

### Never run `pnpm changeset version` locally
CI runs this automatically via the release workflow. Running it locally breaks the automated PR process.

### Docker must be running before tests
```bash
docker compose up -d  # PostgreSQL + Redis + Mailpit
pnpm test
```

### UI imports - no deep imports
Import from `@usequark/quark-ui` (monorepo) or `@<scope>/ui` (scaffolded projects).
Never use `@/components/ui/*` - that Shadcn convention is not used here.
Shared exports also include `ErrorBanner`, `Footer`, `Navbar`/`MobileNavbar`, and `RichText`; extend them with `className` before inventing one-off replacements.

### Two packages are published; everything else is scaffolded
- **Published:** `@usequark/quark-core`, `@usequark/quark-create-app`
- **Scaffolded (local-only):** `config`, `db`, `ui`, `jobs` - these are excluded from versioning and npm publish.

## Quick Setup

```bash
pnpm install
docker compose up -d     # PostgreSQL, Redis, Mailpit
pnpm db:generate         # Generate Prisma client
npx expo login -b        # Required for mobile dev - run BEFORE pnpm dev
pnpm dev                 # Start all apps (web + worker)
```

**IMPORTANT:** When developing with mobile, you must run `npx expo login -b` before `pnpm dev`, otherwise you will not be able to load the dev deployment.

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
│   ├── ui/           # Shared UI components (Tailwind, scaffold template)
│   └── jobs/         # BullMQ job type definitions (scaffold template)
└── docs/             # Architecture, API, roadmap docs
```

## Key Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start all apps |
| `pnpm test` | Run all tests (requires Docker) |
| `pnpm lint` | Lint with Biome |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm changeset` | Create a changeset (interactive, before opening a PR) |
| `pnpm --filter @usequark/quark-create-app sync-templates` | Sync scaffold templates from source |
| `pnpm --filter @usequark/quark-create-app sync-templates:check` | Check for template drift |

## Coding Conventions

- **ESM only** - `import`/`export`. Never `require()` or `module.exports`.
- **No TypeScript** - `.js` and `.jsx` files only.
- **Linting** - Biome for all formatting and linting.
- **Validation** - Zod for all Server Actions and API routes.
- **Errors** - `AppError` / `ValidationError` from `@usequark/quark-core/errors` in app/runtime code.
- **Logging** - `createLogger(name)` from `@usequark/quark-core` in app/runtime code.
- **DB models** - Always include `createdAt` and `updatedAt` on every Prisma model.

## UI & Design System

The `packages/ui` directory contains Tailwind-only, dependency-free Server Component-safe primitives.

Available exports: `Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox`, `Badge`, `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Skeleton`, `ErrorBanner`, `Footer`, `Navbar`/`MobileNavbar`, `RichText`, `Dialog` (client), `Toast`/`useToast` (client), `ThemeProvider`/`useTheme` (client).

Import from `@usequark/quark-ui` (monorepo) or `@<scope>/ui` (scaffolded projects) - never deep-import.

## Template Sync

`packages/cli/templates/` is **generated from monorepo source** - never edited manually (except `TEMPLATE_ONLY` files).

After changing any source file in `apps/web/`, `apps/worker/`, `packages/db/`, `packages/config/`, `packages/ui/`, or `packages/jobs/`:

```bash
pnpm --filter @usequark/quark-create-app sync-templates
```

**`TEMPLATE_ONLY` files** are never overwritten by sync: `CLAUDE.md`, `.cursor/rules/quark.mdc`, `SKILL.md`, GitHub workflows, scaffold READMEs, root `package.json`, biome configs, migrations, and the `opencode` directory.

## Release Workflow

1. Make changes on a branch
2. Run `pnpm changeset` (interactive) to create a changeset file
3. Commit code + changeset, open PR
4. CI runs lint + test + build + changeset-check
5. Merge to `main`
6. Release workflow auto-opens a "chore: version packages" PR
7. Review + merge → publishes to npm + creates GitHub Release

**CRITICAL:** Never run `pnpm changeset version` locally.

**CRITICAL: Merge the release PR with a merge commit, never squash.**

Changesets decides whether to publish by checking whether the current commit
came from the `changeset-release/main` branch. A squash merge rewrites the
commit message to `chore: version packages (#123)`, which drops the branch name,
so the action concludes "no release was merged" and just regenerates the release
PR. The release then **silently never publishes** - versions are bumped in
`package.json` and CHANGELOG, CI is green, and npm keeps serving the old
version. This happened for several releases before it was caught.

Use GitHub's "Create a merge commit" option (or `gh pr merge --merge`) for
release PRs. `scripts/check-release-published.mjs` fails CI if a squash-merged
release commit reaches `main` without publishing.

## Testing

```bash
docker compose up -d  # Required: Postgres 16 + Redis 7
pnpm test             # Run all tests
```

Tests are co-located: `feature.test.js` next to `feature.js`. Uses Node.js built-in `node --test`.

## Key Patterns

### Error Handling
```js
import { AppError, ValidationError } from "@usequark/quark-core/errors";
throw new ValidationError("Email is required");
throw new AppError("Not found", 404, "NOT_FOUND");
```

### Auth Session
```js
import { auth } from "@/lib/auth";
const session = await auth();
if (!session) redirect("/auth/signin");
```

### Server Actions
```js
"use server";
import { z } from "zod";
import { ValidationError, AppError } from "@usequark/quark-core/errors";
import { prisma } from "@__QUARK_SCOPE__/db";

const schema = z.object({ title: z.string().min(1) });

export async function createItem(formData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());
  return prisma.item.create({ data: parsed.data });
}
```

## Architecture Decisions

- **Why no TypeScript?** Lower barrier to contribution; Zod provides runtime type safety at all system boundaries.
- **Why scaffolded (not published) for ui/db/config/jobs?** Projects own their data layer and UI components. No framework-level coupling after scaffold.
- **Why Railway?** Zero-config Postgres + Redis + env injection + tag-based promotion.
- **Why BullMQ?** Redis-backed, production-grade queue with retries, deduplication, priorities, and built-in metrics hooks.
