---
name: quark-context
description: Specific technical context for the Quark Monorepo. Load this alongside other skills.
---

# Quark Context & Standards

## Repository Overview

Quark is a full-stack JS application framework distributed as a monorepo (`Bobnoddle/quark`).  
Two packages are published to npm (with a third planned); everything else is scaffolded locally into user projects.

| Published package | Purpose |
|---|---|
| `@techstream/quark-create-app` | CLI - scaffolds new projects, provides `update` command |
| `@techstream/quark-core` | Runtime library - auth, queues, errors, validation, email, storage, metrics, logging |
| `@techstream/quark-ai` (planned) | AI provider abstraction - unified API for OpenAI, Anthropic, Google, Ollama |

Scaffolded (local-only) packages:

| Package | Required? | Notes |
|---|---|---|
| `@<app>/config` | Yes | Environment config |
| `@<app>/db` | Yes | Prisma schema + client |
| `@<app>/web` | Yes | Next.js application |
| `@<app>/ui` | Optional | Tailwind UI primitives |
| `@<app>/jobs` + `@<app>/worker` | Optional (paired) | BullMQ job definitions + worker process |

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, ES Modules (`"type": "module"`) |
| Package manager | pnpm (workspaces) |
| Monorepo orchestrator | Turborepo (`turbo.json`) |
| Web framework | Next.js 16 (App Router, Server Actions) |
| Database | PostgreSQL 16 + Prisma 7 |
| Queue | BullMQ + Redis 7 |
| Auth | NextAuth v5 (beta) |
| Validation | Zod 4 |
| UI | Tailwind CSS + custom primitives (`packages/ui`) |
| Email | Nodemailer (Mailpit for dev, Resend for prod) |
| Storage | Local filesystem or S3/R2 (pluggable) |
| Linting | Biome |
| Testing | Node.js built-in test runner (`node --test`) |

## Coding Standards

- **Imports:** Use `@techstream/` scope for published packages. Scaffolded packages use project scope (`@<app>/`).
- **Database:** Prisma + Postgres. Always include `createdAt`/`updatedAt` on models.
- **UI:** Tailwind CSS. Keep components atomic. When the `ui` package is selected, use components from `@<app>/ui`. Available exports: `Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox`, `Badge`, `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Skeleton`, `ErrorBanner`, `Footer`, `Navbar`/`MobileNavbar`, `RichText`, `QuarkLogo` (server), `Dialog` (client), `Toast`/`useToast` (client), `ThemeProvider`/`useTheme` (client). All accept `className` for overrides. Do **not** import from `@/components/ui/*` - that Shadcn path convention is not used.
- **UI workflow:** Before building Quark frontend pages, inspect `packages/ui/src/index.js`, `packages/ui/README.md`, `apps/web/src/app/example-page/page.js`, and `apps/web/src/app/playground/page.js`. Prefer shared `@<app>/ui` exports for public layouts, navigation, cards, forms, feedback, and rich content. Extend the scaffolded UI package before creating one-off replacements.
- **Validation:** Zod is mandatory for all Server Actions and API routes.
- **Errors:** Use `AppError` / `ValidationError` from `@techstream/quark-core/errors` in app/runtime code. Native `Error` is acceptable in library, bootstrap, CLI, and test code.
- **Environment:** All env vars validated via `validate-env.js` in the config package. Environment-specific defaults managed by `environment.js`. Centralized config loading via `loadConfig()` from `load-config.js`.
- **Mail env vars:** Use `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM` (not MAILHOG_*).
- **Metrics:** Use `metrics` singleton from `@techstream/quark-core` for counters, gauges, histograms. Pre-registered HTTP metrics: `httpRequestsTotal`, `httpRequestDuration`, `httpRequestsInFlight`, `appErrorsTotal`. Prometheus format exported at `/api/metrics`.
- **Logging:** Use `createLogger(name)` from `@techstream/quark-core` in app/runtime code. Console output is acceptable in bootstrap, CLI, and test code.
- **Config:** Use `loadConfig()` from `@<app>/config` for centralized configuration. Supports per-environment defaults (dev/test/staging/prod) with env-var overrides.
- **Analytics:** Optional Umami support stays app-local in `apps/web/src/lib/analytics/*`. The scaffolded public contract is only `NEXT_PUBLIC_UMAMI_URL`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, and `NEXT_PUBLIC_UMAMI_REPLAY_ENABLED`; replay uses a local rrweb recorder rather than hosted `recorder.js`, and dormant helpers exist for dashboard-generated Umami Links, Pixels, and marketing-email snippets without adding extra env vars.

## CI/CD Pipeline

Three GitHub Actions workflows automate linting, testing, and publishing.

### 1. CI (`ci.yml`) - runs on push to `main` and all PRs

Three sequential jobs:

| Job | What it does |
|---|---|
| **Lint** | `pnpm install --frozen-lockfile` → `pnpm lint` (Biome) |
| **Test** | Spins up Postgres 16 + Redis 7 as service containers → `pnpm test` |
| **Build** | (depends on Lint + Test passing) → `pnpm db:generate` → `pnpm build` |

### 2. Changeset Check (`changeset-check.yml`) - runs on PRs only

Single job that runs `pnpm changeset status` to verify a changeset file exists.  
This ensures every PR that changes published packages includes a version intent.

### 3. Release (`release.yml`) - runs on push to `main` only

Uses `changesets/action@v1` to automate the two-phase release:

**Phase 1 - Version PR:**  
When `.changeset/*.md` files exist on `main`, the action opens (or updates) a PR titled `"chore: version packages"`. That PR contains the version bumps and CHANGELOG entries generated by `pnpm changeset version`.

**Phase 2 - Publish:**  
When the Version PR is merged (no more pending changesets), the action runs `pnpm changeset publish` which publishes to npm using `NPM_PUBLISH_TOKEN`.

After publish, a GitHub Release is created with a date-based tag (`v2026.02.16`, with `.N` suffix for same-day releases) listing all published packages and versions.

### Release Workflow - Developer Steps

```
1. Make code changes on a branch
2. Run: pnpm changeset
   → creates .changeset/<random-name>.md with bump type + description
3. Commit code + changeset file, open PR
4. CI runs lint/test/build + changeset-check verifies changeset exists
5. Merge PR to main
6. Release workflow opens "chore: version packages" PR automatically
7. Review + merge the version PR
8. Release workflow publishes to npm + creates GitHub Release
```

**IMPORTANT:** Never run `pnpm changeset version` locally - the CI does this automatically. Only run `pnpm changeset` (interactive) to create changeset files.

### Changeset Configuration (`.changeset/config.json`)

- **Changelog:** `@changesets/changelog-github` (links commits + PRs)
- **Access:** `public`
- **Base branch:** `main`
- **Ignored packages:** All scaffolded/local packages (`@techstream/quark-web`, `quark-worker`, `quark-config`, `quark-db`, `quark-jobs`, `quark-ui`) - only `quark-core` and `quark-create-app` are versioned/published.

### Changeset File Format

```markdown
---
"@techstream/quark-create-app": patch
"@techstream/quark-core": minor
---

Description of changes (supports markdown)
```

Bump types: `patch` (bug fixes), `minor` (new features), `major` (breaking changes).

### Required Secrets

| Secret | Purpose |
|---|---|
| `GITHUB_TOKEN` | Automatic - used by changesets/action for PRs |
| `NPM_PUBLISH_TOKEN` | npm publish authentication |

### 4. Dependabot Auto-merge (`dependabot-auto-merge.yml`) - runs on PRs

Automatically squash-merges Dependabot PRs that are **patch** updates once CI passes. Minor and major updates require manual review.

**Prerequisites:** Requires "Allow auto-merge" enabled in repo settings AND branch protection rules with required status checks on `main`. Without branch protection, `gh pr merge --auto` won't wait for CI.

### 5. Dependabot (`dependabot.yml`)

Grouped weekly dependency updates (Monday) for both npm and GitHub Actions ecosystems. Production and development dependencies are grouped separately to keep PRs focused.

## Scaffolded Project CI/CD

Scaffolded projects (created by `quark-create-app`) receive their own GitHub Actions workflows, separate from the Quark monorepo's Changesets-based release pipeline.

### Scaffolded Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | Push to `main`, PRs | Lint + Test (Postgres/Redis services) + Build |
| `release.yml` | `workflow_dispatch` (manual) | Creates a date-based tag + GitHub Release |
| `dependabot-auto-merge.yml` | PRs from Dependabot | Auto-merge passing patch updates |

### Scaffolded Release Workflow - Developer Steps

```
1. Work on a feature branch, open PR
2. CI runs lint + test + build automatically
3. Merge PR to main
4. Railway staging auto-deploys (triggered by push to main)
5. When ready for production:
   → GitHub Actions → Release → "Run workflow" (or: gh workflow run release.yml)
   → Creates date-based tag (v2026.02.18) + GitHub Release
   → Railway production deploys from the new tag
```

### Railway Deployment Model

Scaffolded projects are designed for Railway with two services:

| Railway Service | Start Command | Deploy Trigger |
|---|---|---|
| **web** | `node apps/web/.next/standalone/apps/web/server.js` | Push to `main` (staging) or tag (production) |
| **worker** | `node apps/worker/src/index.js` | Push to `main` (staging) or tag (production) |

Railway-managed services: PostgreSQL, Redis. Wire `DATABASE_URL` and `REDIS_URL` into the web and worker services via Railway shared/service variables or Railway service references.

For the web service, the build step must also copy `apps/web/public` and `apps/web/.next/static` into `apps/web/.next/standalone/apps/web/` so the standalone server can serve hashed CSS and JS assets in production.

## Workspace Structure

```
quark/
├── apps/
│   ├── web/          # Next.js app (the Quark source/reference app)
│   └── worker/       # BullMQ worker process
├── packages/
│   ├── cli/          # @techstream/quark-create-app (published)
│   ├── core/         # @techstream/quark-core (published)
│   │   └── src/
│   │       ├── auth/            # NextAuth config + helpers
│   │       ├── authorization.js # RBAC policy engine
│   │       ├── cache.js         # Redis-backed cache with getOrSet/wrap
│   │       ├── csrf.js          # CSRF token generation/validation
│   │       ├── email.js         # SMTP/Resend email service
│   │       ├── email-templates.js # HTML email templates
│   │       ├── error-reporter.js  # Adapter-based error tracking
│   │       ├── errors.js        # AppError, ValidationError, etc.
│   │       ├── file-validation.js # Magic-byte + MIME validation
│   │       ├── logger.js        # Structured logger (zero-dep)
│   │       ├── metrics.js       # Counters, gauges, histograms (Prometheus)
│   │       ├── multipart.js     # Streaming multipart parser
│   │       ├── queue/           # BullMQ queue helpers
│   │       ├── rate-limiter.js  # In-memory + Redis rate limiting
│   │       ├── redis.js         # Redis client + ping
│   │       ├── storage.js       # Local/S3 file storage adapter
│   │       ├── testing/         # Test factories + utilities
│   │       ├── utils.js         # Shared utilities
│   │       └── validation.js    # Zod body validation helper
│   ├── config/       # Environment validation + config loading
│   │   └── src/
│   │       ├── app-url.js       # APP_URL resolution + CORS origins
│   │       ├── environment.js   # Per-environment defaults (dev/test/staging/prod)
│   │       ├── load-config.js   # Centralized config loader with caching
│   │       └── validate-env.js  # Environment variable validation
│   ├── db/           # Prisma schema + client + query helpers
│   ├── jobs/         # Job type definitions
│   └── ui/           # Shared UI components
├── docs/             # Architecture, API, roadmap, OpenAPI, DB schema docs
├── .changeset/       # Changeset config + pending changesets
└── .github/workflows/  # CI, release, changeset-check
```

## Database Seeding

Seed file: `packages/db/prisma/seed.js` (scaffolded template: `packages/cli/templates/base-project/packages/db/prisma/seed.js`).
Run via `pnpm db:seed`, configured in `prisma.config.js` as `tsx prisma/seed.js`.

| `SEED_PROFILE` | Records created | Use case |
|---|---|---|
| `minimal` | Admin user only | Production first deploy |
| `dev` *(default)* | Admin + sample viewer + audit log + job | Staging, local, E2E |

**Critical:** `SEED_PROFILE` must NOT be derived from `NODE_ENV`. Railway sets `NODE_ENV=production` on all deployed services (including staging) for performance reasons. Use `SEED_PROFILE` explicitly:
- Production: `SEED_PROFILE=minimal pnpm --filter @techstream/quark-db db:seed`
- Staging: `pnpm --filter @techstream/quark-db db:seed`

Both profiles are idempotent (safe to re-run). Staging full wipe: `prisma migrate reset --force` (calls seed automatically).

**Migrations on deploy** are automated via `releaseCommand` in `apps/web/railway.json`: `prisma migrate deploy` runs before traffic switches on every Railway deploy.

## Key Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start all apps in development |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint with Biome |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm changeset` | Create a new changeset (interactive) |
| `pnpm --filter @techstream/quark-create-app sync-templates` | Sync CLI scaffold templates from monorepo source |
| `pnpm --filter @techstream/quark-create-app sync-templates:check` | Check for template drift without modifying files |

## Edge Proxy (`apps/web/src/proxy.js`)

**File convention:** Next.js 16 uses `proxy.js` (not `middleware.js` - that name is deprecated as of Next.js 16 and will produce a warning). Never create `middleware.js`; all edge logic belongs in `proxy.js`.

`proxy.js` is the single edge entry point. It runs on every non-static request and handles (in order):

| Layer | What it does |
|---|---|
| **Metrics guard** | If `METRICS_TOKEN` env var is set, `/api/metrics` requires `Authorization: Bearer <token>` or `x-metrics-token` header. Unset = unprotected (safe for dev). |
| **Rate limiting** | 100 req/15 min for API, 5 req/15 min for `/api/auth/*`. In-memory by default; swap `proxy.js` for `proxy.redis.js` in multi-instance deployments. |
| **CORS** | Allowed origins from `getAllowedOrigins()` in `@<app>/config`. Preflight `OPTIONS` returns 204. |
| **Security headers** | HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. CSP adds `unsafe-eval` only in non-production (Turbopack requirement). |
| **Body size limits** | 2 MB for API, 10 MB for uploads (configurable via `API_BODY_SIZE_LIMIT` / `UPLOAD_SIZE_LIMIT`). |

**Key patterns:**
- `callbackUrl` includes `pathname + search` to preserve query params across the redirect.
- The `config.matcher` excludes `_next/static`, `_next/image`, favicon, and common image types.
- `proxy.redis.js` is an alternative implementation with Redis-backed rate limiting - not synced to templates, only the in-memory `proxy.js` is.

## Template Sync

CLI scaffold templates (`packages/cli/templates/`) are **generated from monorepo source**, not manually maintained. This prevents drift between the monorepo reference implementation and what new projects receive.

**How it works:**
- `packages/cli/scripts/sync-templates.js` copies files from monorepo → templates, applying exclusions and transforms
- CI runs a template-drift check on every push/PR - fails if templates are stale
- Template-only files (generation templates with `__PLACEHOLDER__` variables, scaffold README, `.gitignore`, GitHub workflows, dependabot config) are preserved and never overwritten

**When to sync:** After changing any file in `apps/web/`, `apps/worker/`, `packages/db/`, `packages/config/`, `packages/ui/`, `packages/jobs/`, or root config files (`turbo.json`, `docker-compose.yml`, `pnpm-workspace.yaml`).

**What's excluded from sync:** `.next/`, `node_modules/`, `coverage/`, Prisma generated code (`src/generated/`), monorepo-only files (metrics, SEO, redis proxy, integration tests), and DB migrations (template maintains its own squashed initial migration).
