# Start Here

This is the shortest current path through a newly scaffolded Quark project.

## Read these first

1. `README.md` - quick start, included features, and first files to edit
2. `docs/FIRST_FEATURE.md` - the canonical first product feature walkthrough
3. `CLAUDE.md` - AI tool context for code generation and refactors

## Know the project contract

Every Quark scaffold gives you:

- `apps/web` - the Next.js app
- `packages/db` - Prisma schema, client, and query helpers
- `packages/config` - validated environment config
- optional local packages like `ui`, `jobs`, `admin`, and `cms`

The package READMEs explain optional features if they are present:

- `packages/ui/README.md`
- `packages/jobs/README.md`
- `packages/admin/README.md`
- `packages/cms/README.md`

## Best order to learn the codebase

1. `packages/db/prisma/schema.prisma`
2. `packages/db/src/queries.js`
3. `apps/web/src/app/`
4. `apps/web/src/lib/auth.js`
5. `apps/worker/src/handlers/` if your project includes background jobs

## Build next

Follow `docs/FIRST_FEATURE.md` and ship one thin vertical slice:

1. add a model
2. migrate the database
3. add query helpers
4. build the page or mutation
5. add one focused test

That is the fastest way to move from "starter" to "product code."

## Keep your scaffold visible

Before taking Quark infrastructure updates, review scaffold-managed drift from the project root:

```bash
npx @techstream/quark-create-app update --scaffold-check
```

If you want CI to fail when scaffold-managed files drift, use:

```bash
npx @techstream/quark-create-app update --scaffold-check --fail-on-drift
```

## Recover disk space

When local build artifacts pile up, run these from the project root:

```bash
pnpm clean:check   # Preview reclaimable build artifacts
pnpm clean         # Remove .turbo, .next, build, dist, and coverage output
pnpm clean:deep    # Also remove repo-local temp workspaces
```

`pnpm dev` also auto-cleans stale oversized local artifacts at most once per day. Set `QUARK_SKIP_AUTO_CLEAN=1` if you want to skip that behavior for a run.
