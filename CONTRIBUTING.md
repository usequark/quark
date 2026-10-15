# Contributing to Quark

Thanks for your interest in contributing! This guide covers the essentials.

## Getting Started

```bash
git clone https://github.com/usequark/quark.git
cd quark
pnpm install
docker compose up -d     # PostgreSQL, Redis, Mailpit
pnpm db:generate         # Generate Prisma client
pnpm dev                 # Start web + worker
```

## Development Workflow

If you do not have write access, **fork the repository** first and push your
branch to your fork. Open the pull request from your fork's branch -- the
"Open a PR" flow below works identically either way, and you do not need to be
invited.

1. **Create a branch** from `main` for your change
2. **Make your changes** following the coding standards below
3. **Run checks** before pushing:
   ```bash
   pnpm lint              # Biome formatting and linting
   pnpm test              # All tests (requires Docker)
   ```
4. **Open a PR** against `main`. CI will run lint, test, build, and security scans. Review against [docs/CODE_REVIEW_CHECKLIST.md](docs/CODE_REVIEW_CHECKLIST.md) before requesting review.

### What happens next

- `main` is protected. A merge requires **Lint & Standards**, **Changeset
  Status**, **Test**, **Mobile**, and **Build** to pass. If any check fails, the
  PR cannot be merged.
- A **changeset is required** for any change to `packages/core` or
  `packages/cli`, because those are the two packages published to npm. Run
  `pnpm changeset` and commit the file it writes. CI fails without one. A
  change that does not warrant a release can use
  `pnpm changeset add --empty`.
- Changes touching `packages/core/`, `packages/cli/`, `packages/cli/templates/`,
  `packages/db/`, `migrations/`, or `.github/workflows/` require maintainer
  review via `.github/CODEOWNERS`.
- Expect a review comment before merge. Small, focused PRs get reviewed
  fastest; a diff that touches a published package and its template in one
  commit will be asked to split.

## Coding Standards

- **ESM only** -- `import`/`export` everywhere. Never `require()` or `module.exports`.
- **No authored TypeScript** -- `.js` and `.jsx` files only. The `apps/mobile/` directory is the only exception (React Native / Expo requires it).
- **No `throw new Error()`** in app/runtime code -- use `AppError` / `ValidationError` from `@usequark/quark-core/errors`. Native `Error` is reserved for library, bootstrap, CLI, and test code.
- **No `console.log/error`** in app/runtime code -- use `createLogger(name)` from `@usequark/quark-core`. Console output is reserved for bootstrap, CLI, and test code.
- **Zod required** -- all Server Actions and API routes must validate with Zod. No exceptions.
- **Biome only** -- no ESLint, no Prettier. Run `pnpm lint` to check.
- **DB models** -- every Prisma model must include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
- **Tests** -- co-located: `feature.test.js` next to `feature.js`. Uses Node.js built-in `node --test`.

## Project Structure

```
quark/
├── apps/
│   ├── web/          # Next.js 16 reference app (App Router, Server Actions)
│   ├── worker/       # BullMQ background worker
│   └── mobile/       # React Native / Expo (TypeScript required)
├── packages/
│   ├── cli/          # @usequark/quark-create-app (published to npm)
│   ├── core/         # @usequark/quark-core (published to npm)
│   ├── db/           # Prisma schema + client + queries
│   ├── config/       # Environment validation + config loading
│   ├── ui/           # Shared UI components (Tailwind)
│   └── jobs/         # BullMQ job type definitions
└── docs/             # Architecture, API, roadmap docs
```

## Testing

```bash
docker compose up -d  # Required: Postgres + Redis + Mailpit
pnpm test             # Run all tests
```

## Commit Conventions

We use [Changesets](https://github.com/changesets/changesets) for versioning. When making user-facing changes:

```bash
pnpm changeset         # Interactive changeset creation
```

This creates a changeset file that describes your change. Include it in your commit.

## Versioning and release policy

This is the canonical semver policy. [docs/UPGRADING.md](docs/UPGRADING.md)
is its per-release consequence — link there, do not restate it.

- **Minor or major with a migration note:** any security-default change and
  any behaviour change. Security-sensitive defaults fail closed, and the
  changeset plus `docs/UPGRADING.md` must say what changed, who is affected,
  and what to do about it.
- **Patch:** docs, tests, comments, and CI only. A patch must not change
  runtime behaviour. If it changes what the code does, it is at least a minor.
- **Dated releases:** every new CHANGELOG heading carries its date as
  `## x.y.z - YYYY-MM-DD`. Changesets emits no dates, so the release
  workflow stamps them automatically: `scripts/release-version.mjs` (the
  `version` step of `.github/workflows/release.yml`) runs
  `node scripts/stamp-changelog-dates.mjs` after `changeset version`, which
  stamps only the just-added heading (top heading equals the bumped
  `package.json` version). Never hand-edit a date; historical undated
  headings stay undated rather than carry an invented one.

Wave-1 is the conforming reference: the refresh-token DB re-read (minor
with migration note), `TRUST_PROXY_HEADERS` (minor),
`REQUIRE_EMAIL_VERIFICATION` defaulting to true (minor with migration note),
and the scaffold-check scoping fix (minor with note) all shipped as minors,
while the CI scaffold-compile harness, the Job index comment correction, and
the worker README table generation shipped as patches (docs/tests only, no
runtime behaviour change).

## Reporting Issues

- **Bugs**: Open a GitHub issue with steps to reproduce
- **Security vulnerabilities**: See [SECURITY.md](SECURITY.md) -- do not open a public issue
- **Feature requests**: Open a GitHub issue describing the use case

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
