# Developer Onboarding — Techstream Monorepo

## Quick start

- Install dependencies (root workspace):

```bash
pnpm install -w
```

- Run dev for all apps (uses Turbo):

```bash
pnpm dev
```

- Build and start:

```bash
pnpm build
pnpm start
```

## Testing

- Unit tests use Node.js native `node:test` runner. Run:

```bash
pnpm test
```

- E2E tests will live under `apps/web/e2e` using Playwright.

## Linting & formatting

- Biome is the single source of truth at the repo root (`biome.json`). Run:

```bash
pnpm lint
```

## Database

- Prisma schema: `packages/db/prisma/schema.prisma`.
- Generate client:

```bash
pnpm -w run db:generate
```

- Seeding scripts (planned): `packages/db/scripts/seed.*` — environment-aware seeds (dev/test/prod).

## Stack

- **Language:** JavaScript (pure ESM, Node.js native APIs)
- **Framework:** Next.js 16 (React 19 compatible)
- **Testing:** Node.js built-in `node:test` runner
- **Linting/Formatting:** Biome (single tool)
- **Package Manager:** pnpm v10+
- **Monorepo Tool:** Turbo
- **ORM:** Prisma

## Conventions

- Packages follow `src/` structure with `.js` and `.jsx` files.
- Tests live next to sources or in `tests/` where appropriate, using `*.test.js` naming.
- Use native Node.js modules (`node:test`, `node:assert`) for testing.
- All code is ESM-compliant.

## Notes & next steps

- We've standardized on **JavaScript** (no TypeScript) to reduce tooling complexity.
- Tests use Node's built-in `node:test` runner and `node:assert` for a zero-dependency test setup.
- Biome handles all lint/format — single config file, no tool conflicts.
- Playwright will be added for CI-friendly E2E + accessibility testing.

