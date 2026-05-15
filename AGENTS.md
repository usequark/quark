# Quark — Agent Context

> Full contributor guide: `CLAUDE.md`. This file surfaces the rules and gotchas most likely to cause agent mistakes.

## Non-Negotiable Rules

- **ESM only** — `import`/`export` everywhere. Never `require()` or `module.exports`.
- **No authored TypeScript** — `.js` and `.jsx` files only. Generated code may emit typed artifacts, but repo code should not add `.ts`, `.tsx`, type annotations, or `tsconfig`.
- **No `throw new Error()` in app/runtime code** — use `AppError` / `ValidationError` from `@techstream/quark-core/errors`. Native `Error` is reserved for library, bootstrap, CLI, and test code.
- **No `console.log/error` in app/runtime code** — use `createLogger(name)` from `@techstream/quark-core`. Console output is reserved for bootstrap, CLI, and test code.
- **Zod required** — all Server Actions and API routes must validate with Zod. No exceptions.
- **Biome only** — no ESLint, no Prettier. Run `pnpm lint` to check.
- **DB models** — every Prisma model must include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.

## Critical Gotchas

### Templates are generated — never edit them directly
`packages/cli/templates/` is auto-generated from monorepo source. Editing files there directly will be overwritten.
After changing source files in `apps/web/`, `apps/worker/`, `packages/db/`, `packages/config/`, `packages/ui/`, or `packages/jobs/`, run:
```bash
pnpm --filter @techstream/quark-create-app sync-templates
```

### Never run `pnpm changeset version` locally
CI runs this automatically via the release workflow. Running it locally breaks the automated PR process.

### Docker must be running before tests
```bash
docker compose up -d  # PostgreSQL + Redis + Mailpit
pnpm test
```
Tests will fail silently or with connection errors if Postgres/Redis aren't up.

### UI imports — no deep imports
Import from `@techstream/quark-ui` (monorepo) or `@<scope>/ui` (scaffolded projects).
Never use `@/components/ui/*` — that Shadcn convention is not used here.

### Two packages are published; everything else is scaffolded
- **Published:** `@techstream/quark-core`, `@techstream/quark-create-app`
- **Scaffolded (local-only):** `config`, `db`, `ui`, `jobs`, `admin` — these are excluded from versioning and npm publish.

## Key Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start all apps |
| `pnpm test` | Run all tests (requires Docker) |
| `pnpm lint` | Lint with Biome |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm changeset` | Create a changeset (interactive, before opening a PR) |
