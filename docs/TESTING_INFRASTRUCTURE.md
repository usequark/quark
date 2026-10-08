# Quark Testing Infrastructure Report

**Last Updated:** October 7, 2026  
**Audience:** Contributors, maintainers, CI engineers  
**Purpose:** Comprehensive reference for testing approach, organization, tools, and patterns

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Testing Architecture](#testing-architecture)
3. [Test Organization & Files](#test-organization--files)
4. [Testing Frameworks & Libraries](#testing-frameworks--libraries)
5. [Running Tests](#running-tests)
6. [CI/CD Testing Workflow](#cicd-testing-workflow)
7. [Test Utilities & Patterns](#test-utilities--patterns)
8. [Database & Redis Setup](#database--redis-setup)
9. [Coverage Strategy](#coverage-strategy)
10. [Best Practices](#best-practices)
11. [Gaps & Recommendations](#gaps--recommendations)

---

## Executive Summary

Quark uses a **lightweight, dependency-free testing approach** built on the Node.js native test runner (`node --test`). There are **no external test frameworks** (Jest, Vitest, Mocha, Playwright) anywhere in the repo. Testing is **CI-integrated** via GitHub Actions with real PostgreSQL 16 and Redis 7 services.

### Key Characteristics

| Aspect | Value |
|--------|-------|
| **Framework** | Node.js native `node:test` |
| **Total `*.test.js` files (repo-wide)** | **130** |
| **Live test files wired into a `test` script** | **100** |
| **Archived reference test files** | **30** (under `docs/archive/reference/`) |
| **Additional `*.test.mjs` files** | **3** (under `scripts/`) |
| **Assertion Library** | `node:assert/strict` |
| **Most Tested Workspace** | `packages/core` (27 test files) |
| **CI Services** | PostgreSQL 16 (`postgres:16-alpine`), Redis 7 (`redis:7-alpine`) |
| **Root Command** | `pnpm test` → `node --test 'scripts/*.test.mjs' && turbo run test` |
| **Coverage** | Optional/ad-hoc. **Not enforced** anywhere in CI |
| **Test Naming** | `*.test.js` co-located with source |

### How These Counts Were Measured

Every count in this document comes from the filesystem, not from an estimate. Repository root:

```bash
# Repo-wide total for *.test.js
find . -name "*.test.js" -not -path "*/node_modules/*" -not -path "*/.next/*" | wc -l
# => 130

# Per-workspace counts (same find, scoped to each workspace directory)
find packages/core -name "*.test.js" -not -path "*/node_modules/*" -not -path "*/.next/*" | wc -l
# => 27

# The 30 files that are archived reference material, not wired into any test script
find docs/archive -name "*.test.js" -not -path "*/node_modules/*" | wc -l
# => 30

# The .mjs suites run by the root script before turbo takes over
ls scripts/*.test.mjs
# => scripts/check-release-published.test.mjs
#    scripts/check-standards.test.mjs
#    scripts/run-tests.test.mjs
```

`100 + 30 = 130`. The `docs/archive/reference/` files are preserved vertical examples (cms, crm, ai, bookings) that were removed from the build. They are not executed by `pnpm test`, so the number that matters for the pipeline is **100 live test files**.

---

## Testing Architecture

### Why Node.js Native Test Runner?

- **Zero external dependencies**, aligns with Quark's ESM-only, minimal-dependency philosophy
- **Built-in to Node 22+**, no additional install surface (engines: `>=22.13.0`, see [package.json](../package.json))
- **Fast startup**, native runner vs. Jest/Vitest bootstrap overhead
- **Clear assertions**, `node:assert/strict` catches subtle bugs
- **Familiar pattern**, `describe()`, `test()`, `beforeEach()`, `afterEach()`

See [ADR-002: No TypeScript](./adr/002-no-typescript.md) for Quark's philosophy on simplicity.

### Test Organization Model

```
packages/<pkg>/src/
├── module.js
├── module.test.js          ← Co-located test file
package.json
├── "test": "node --test $(find src -name '*.test.js')"     # config, jobs
├── "test": "node --test 'src/**/*.test.js'"                # db
└── "test": "node ../../scripts/run-tests.mjs src"          # core, ui, web, worker
```

`scripts/run-tests.mjs` is a small recursive collector used by `packages/core`, `packages/ui`, `apps/web`, and `apps/worker`. It walks the `src` tree and collects:

- `*.test.js`
- `*.integration-test.js` (renders components through jsdom + react-dom, so it must be collected too)

It accepts `--exclude=<name>` exclusions. `apps/web` uses it as `node ../../scripts/run-tests.mjs src --exclude=integration.test.js`, which keeps `apps/web/src/app/api/integration.test.js` out of the default `test` task and reserves it for `test:integration`.

**Benefits:**
- Tests live next to source, easier to keep in sync
- Clear 1:1 mapping between module and test
- IDEs can easily navigate between them

### Assertion Style

```js
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ValidationError } from "@usequark/quark-core/errors";

describe("createUser", () => {
  test("creates user with valid email", () => {
    const user = { id: "user_abc123", email: "test@example.com" };
    assert.strictEqual(user.email, "test@example.com");
    assert.ok(user.id);
  });

  test("throws ValidationError on invalid email", () => {
    assert.throws(
      () => validateEmail("invalid"),
      ValidationError,
      /invalid email/i,
    );
  });
});
```

Quark's error convention applies in tests too: throw `ValidationError` or `AppError` from `@usequark/quark-core/errors`, never a bare `Error`.

---

## Test Organization & Files

### Breakdown by Workspace (measured counts)

| Workspace | `*.test.js` | Notes |
|-----------|-------------|-------|
| `packages/core` | **27** | Most comprehensive |
| `apps/web` | **26** | Route handlers, SEO, analytics, proxy |
| `packages/ui` | **20** | One suite per UI module |
| `packages/cli` | **15** | Scaffold guards, deploy adapters, templates |
| `packages/db` | **4** | Includes `queries.integration.test.js` |
| `packages/config` | **4** | |
| `apps/worker` | **3** | |
| `packages/jobs` | **1** | |
| **Live total** | **100** | Wired into a `test` script |
| `docs/archive/reference` | **30** | Archived verticals, not executed |
| **Repo-wide total** | **130** | |

#### `packages/core` (27 test files)

```
src/admin.test.js                    src/health.test.js
src/auth.test.js                     src/logger.test.js
src/auth/middleware.test.js          src/metrics.test.js
src/authorization.test.js            src/multipart.test.js
src/cache.test.js                    src/pagination.test.js
src/csrf.test.js                     src/query-builder.test.js
src/db-instrumentation.test.js       src/queue/queue.test.js
src/db.test.js                       src/rate-limiter.test.js
src/email-templates.test.js          src/redis.test.js
src/email.test.js                    src/request-logger.test.js
src/error-reporter.test.js           src/storage.test.js
src/errors.test.js                   src/testing/testing.test.js
src/exports.test.js                  src/utils.test.js
src/file-validation.test.js
```

`exports.test.js` is worth calling out: it asserts the public export surface of the package, so an accidental removal from `src/index.js` fails the suite rather than surfacing as a broken import in a consumer app.

#### `packages/ui` (20 test files)

One suite per module, matching the 24-module barrel in `packages/ui/src/index.js` (four modules have no dedicated suite):

```
badge, button, card, checkbox, container, dialog, footer, form-field, input, label,
lightbox, rich-text, select, skeleton, spinner, table, textarea, theme, theme-vars, toast
```

Plus two integration suites that are **not** picked up by `test` and run separately via `test:integration`:

- `src/lightbox.integration-test.js`
- `src/form-field.integration-test.js`

```bash
pnpm --filter ./packages/ui test:integration
```

Filtering by directory path rather than by package name keeps this unambiguous: `packages/ui` is private and never published, so its monorepo-internal package name is not something you should rely on in a scaffolded project.

Note the suffix is `-integration-test.js`, which is deliberately distinct from `*.integration.test.js`. The `test` script excludes only the latter name, so these two do run under `turbo run test`.

#### `packages/config` (4 test files)

| Test File | Purpose |
|-----------|---------|
| `index.test.js` | Config object creation, barrel exports |
| `environment.test.js` | Env var resolution, Zod schemas |
| `load-config.test.js` | Configuration loading order |
| `app-url.test.js` | URL formatting logic |

#### `packages/db` (4 test files)

| Test File | Purpose |
|-----------|---------|
| `connection.test.js` | Prisma client initialization, env var priority |
| `context.test.js` | Request-scoped client context |
| `queries.test.js` | Query helper assertions |
| `queries.integration.test.js` | Query helpers against a live database |

`packages/db` runs with `node --test 'src/**/*.test.js'`, which matches both `.test.js` and `.integration.test.js`, so the integration suite runs as part of `pnpm test`. This is why the database must be reachable when the full suite runs.

#### `packages/jobs` (1 test file)

| Test File | Purpose |
|-----------|---------|
| `definitions.test.js` | `JOB_QUEUES` and `JOB_NAMES` shape |

#### `packages/cli` (15 test files)

```
src/dependabot-config.test.js         src/scaffold-output.test.js
src/deploy/deploy.test.js             src/template-config.test.js
src/deploy/deploy.integration.test.js src/template-scripts.test.js
src/deploy/discovery.test.js          src/worker-dockerfile.test.js
src/deploy/adapters/iac.test.js       src/mobile-template.test.js
src/deploy/adapters/railway.test.js   src/prepare-hooks.test.js
src/git-branch.test.js                src/scaffold-guards.test.js
src/utils.test.js
```

The `test` script runs these explicitly, and pins integration suites to serial execution:

```json
"test": "node test-cli.js && node --test src/utils.test.js && ... && node --test 'src/deploy/**/*.test.js' && node --test --test-concurrency=1 'src/deploy/**/*.integration.test.js'"
```

The CLI package also ships non-`node:test` harnesses at the package root: `test-cli.js`, `test-build.js`, `test-e2e.js`, `test-e2e-full.js`, `test-integration.js`, `test-flags.js`, `test-all.js`.

#### `apps/worker` (3 test files)

| Test File | Purpose |
|-----------|---------|
| `index.test.js` | BullMQ worker and handler registration |
| `lib/tokens.test.js` | Token helpers |
| `handlers/files.test.js` | File job handler |

#### `apps/web` (26 test files)

| Area | Test Files |
|------|-------------|
| **API routes** | `api/auth/[...nextauth]/route.test.js`, `api/files/route.test.js`, `api/files/[id]/route.test.js`, `api/health/route.test.js`, `api/users/route.test.js`, `api/users/[id]/route.test.js` |
| **Integration** | `app/api/integration.test.js` (excluded from `test`, run by `test:integration`) |
| **Pages & layout** | `app/page.test.js`, `app/layout-theme.test.js`, `app/manifest.test.js`, `app/auth/provider-loading.test.js` |
| **SEO** | `app/seo-routes.test.js`, `lib/seo/indexing.test.js`, `lib/seo/site-metadata.test.js` |
| **Analytics** | `lib/analytics/umami-before-send.test.js`, `umami-config.test.js`, `umami-csp.test.js`, `umami-marketing.test.js`, `umami-replay.test.js` |
| **Auth internals** | `lib/auth-middleware.test.js`, `lib/normalize-auth-request.test.js`, `lib/proxy-auth.test.js`, `lib/csrf-cookie.test.js`, `proxy.test.js` |
| **Config & preflight** | `next-config.test.js`, `preflight.test.js` |

---

## Testing Frameworks & Libraries

### Node.js Native Test Runner

**Module:** `node:test`  
**Assertion:** `node:assert/strict`  
**Availability:** Node 18+; Quark requires `>=22.13.0` ([package.json](../package.json) `engines.node`). CI runs Node 24.

```js
import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("Module", () => {
  test("does something", () => {
    assert.strictEqual(actual, expected);
  });
});
```

### What Is Not In The Repo

There is deliberately **no**:

- Jest, Vitest, Mocha, or any other test framework
- Playwright or any browser automation runner
- Storybook or any component explorer
- A `test:coverage` script
- A `test:watch` script
- A coverage config file (`.nycrc`, `c8` config, `jest.config.js`, `vitest.config.js`)

The only test-related third-party packages in the whole workspace are `jsdom` and `react-dom` (used by the two UI `*.integration-test.js` suites) and `dotenv-cli` (used by local script runners).

### Why No Jest/Vitest?

1. **Zero dependency footprint**, reduces supply chain risk
2. **Faster CI startup**, native runner bootstraps instantly
3. **Alignment with architecture**, Quark minimizes dependencies throughout
4. **Good enough for the monorepo**, the native runner covers the current suite

**Trade-offs:**
- No built-in snapshot testing or advanced mocking
- Workaround: use [`createMockPrisma()`](#mocks) and [`captureConsole()`](#helpers) for common needs
- See [Gaps & Recommendations](#gaps--recommendations) for the consequences

---

## Running Tests

### Local Development

#### Run All Tests

```bash
pnpm test
```

Root `test` is:

```
node --test 'scripts/*.test.mjs' && turbo run test
```

Two phases. First the three root `scripts/*.test.mjs` suites run directly, then `turbo run test` fans out to every workspace that defines a `test` script. `turbo run test` depends on `^build` and `db:generate`, so the Prisma client is generated before any suite that needs it.

The web app's integration suite is **not** part of `pnpm test`:

```bash
pnpm test:integration    # → pnpm --filter @usequark/quark-web test:integration
```

#### Test Scripts Per Workspace (authoritative)

| Workspace | `test` | Other test scripts |
|-----------|--------|--------------------|
| root | `node --test 'scripts/*.test.mjs' && turbo run test` | `test:integration` |
| `packages/core` | `node ../../scripts/run-tests.mjs src` | - |
| `packages/cli` | `node test-cli.js && node --test src/*.test.js ...` | `test:build`, `test:e2e`, `test:e2e:full`, `test:integration`, `test:flags`, `test:all` |
| `packages/ui` | `node ../../scripts/run-tests.mjs src` | `test:integration` |
| `packages/db` | `node --test 'src/**/*.test.js'` | - |
| `packages/config` | `node --test $(find src -name '*.test.js')` | - |
| `packages/jobs` | `node --test $(find src -name '*.test.js')` | - |
| `apps/web` | `node ../../scripts/run-tests.mjs src --exclude=integration.test.js` | `test:integration` |
| `apps/worker` | `node ../../scripts/run-tests.mjs src` | - |

#### Run Tests for a Specific Workspace

```bash
pnpm --filter @usequark/quark-core test
pnpm --filter @usequark/quark-create-app test
pnpm --filter ./apps/worker test
```

#### Run Tests in Watch Mode

There is no `pnpm test:watch` script. Node's own watcher covers it:

```bash
node --watch --test packages/core/src/rate-limiter.test.js
```

Or use your IDE's file watcher.

#### Run a Single Test File

```bash
node --test packages/core/src/auth.test.js
```

#### Run Tests Matching a Pattern

```bash
node --test --test-name-pattern="rate" packages/core/src/rate-limiter.test.js
```

### CLI-Specific Tests

`packages/cli` has the largest custom harness, because it has to scaffold, build, and deploy real projects:

```bash
# Default: template/unit suites plus src/*.test.js (see the script above)
pnpm --filter @usequark/quark-create-app test

# Build verification of generated projects (opt-in via env var)
QUARK_CLI_BUILD_TEST=1 pnpm --filter @usequark/quark-create-app test:build

# Lightweight E2E scaffold simulation
pnpm --filter @usequark/quark-create-app test:e2e

# Full E2E with real Docker services (Postgres, Redis, Mailpit)
pnpm --filter @usequark/quark-create-app test:e2e:full

# Performance gate, run after test:e2e:full
pnpm --filter @usequark/quark-create-app check:perf

# Feature-flag suite
pnpm --filter @usequark/quark-create-app test:flags

# Everything
pnpm --filter @usequark/quark-create-app test:all
```

There is **no `test:cli` script**. The `test` script already begins with `node test-cli.js`.

See [packages/cli/README.md](../packages/cli/README.md) for details.

### Prerequisites

Suites that touch persistent services need Postgres and Redis running:

```bash
# Start services
docker compose up -d

# Generate the Prisma client (turbo also does this before the test task)
pnpm db:generate

# Run tests
pnpm test

# Clean up
docker compose down
```

`docker compose up -d` starts PostgreSQL 16 and Redis 7 from `docker-compose.yml`, plus Mailpit from `docker-compose.override.yml`.

**Environment variables** for local testing come from [.env.example](../.env.example):
```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=quark_user
POSTGRES_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD
POSTGRES_DB=quark_dev
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Git Hooks

The repo wires tests into a **pre-push** hook, not a pre-commit hook:

```json
"simple-git-hooks": {
  "pre-commit": "pnpm nano-staged && node packages/cli/scripts/sync-templates.js --pre-commit",
  "pre-push": "node scripts/pre-push.mjs"
}
```

`scripts/pre-push.mjs` runs `node scripts/check-changeset.mjs` (changeset presence check) and then `pnpm test`. It skips the test phase when `node_modules` is absent, on the assumption that CI will catch it.

The pre-commit hook runs Biome format + check via `nano-staged` and syncs CLI templates. It does **not** run tests, so a broken test suite is caught at push time, not commit time.

---

## CI/CD Testing Workflow

### Continuous Integration Pipeline

Defined in [.github/workflows/ci.yml](../.github/workflows/ci.yml). Triggers: push to `main`, pull requests targeting `main`. Concurrency group `ci-${{ github.ref }}` with `cancel-in-progress: true`.

```
┌──────────────────────────────────────────────────────────────┐
│ Job: checks  ("Lint & Standards")                            │
│ - pnpm install --frozen-lockfile                             │
│ - pnpm lint           (biome format --write && biome check)  │
│ - pnpm standards      (node scripts/check-standards.mjs)     │
│ - pnpm --filter @usequark/quark-create-app sync-templates    │
│ - git diff --quiet packages/cli/templates/  (drift gate)     │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Job: test                                                   │
│ Services:                                                   │
│   - postgres:16-alpine  (pg_isready health check)           │
│   - redis:7-alpine       (redis-cli ping health check)       │
│ Steps: install → pnpm db:generate → pnpm test                │
│ Env: POSTGRES_USER/PASSWORD/HOST/PORT/DB, REDIS_HOST/PORT,  │
│      NEXTAUTH_SECRET                                         │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Job: mobile                                                 │
│ - pnpm --filter @usequark/quark-mobile lint                  │
│ - npx tsc --noEmit  (working-directory: apps/mobile)         │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Job: build  (needs: checks, test, mobile)                    │
│ - pnpm install --frozen-lockfile                             │
│ - pnpm db:generate                                           │
│ - pnpm build                                                 │
└──────────────────────────────────────────────────────────────┘
```

The template drift gate shares the `checks` job's install rather than paying for a second full monorepo install. It is skipped when the actor is `dependabot[bot]` on a pull request.

### Workflow Details

| Job | Command | `needs` | Services |
|-----|---------|---------|----------|
| **checks** | `pnpm lint`, `pnpm standards`, template drift diff | - | None |
| **test** | `pnpm test` | - | Postgres 16, Redis 7 |
| **mobile** | `pnpm --filter @usequark/quark-mobile lint`, `tsc --noEmit` | - | None |
| **build** | `pnpm build` | checks, test, mobile | None |

`checks`, `test`, and `mobile` run in parallel. Only `build` is gated on them.

The mobile job is the one place `tsc` appears in CI. `apps/mobile/` is an Expo / React Native target and is the documented exception to the "no authored TypeScript" rule.

### Test Environment Variables

The `test` job supplies test-specific credentials inline in the workflow (not from secrets):

```yaml
env:
  POSTGRES_USER: quark_user
  POSTGRES_PASSWORD: test_password
  POSTGRES_HOST: localhost
  POSTGRES_PORT: 5432
  POSTGRES_DB: quark_test
  REDIS_HOST: localhost
  REDIS_PORT: 6379
  NEXTAUTH_SECRET: ci-test-secret-not-for-production
```

Service-level `POSTGRES_*` env and ports mirror these on the `postgres:16-alpine` service.

### CLI E2E Workflow

**Workflow:** [.github/workflows/cli-e2e-full.yml](../.github/workflows/cli-e2e-full.yml)

- **Trigger:** pushes to `main` touching `packages/cli/**`, or manual `workflow_dispatch` with a ref input
- **Timeout:** 10 minutes
- **Steps:** `test:e2e:full` then `check:perf`, with **one automatic retry**. The step is `continue-on-error: true` so a single noisy sample cannot latch the job to failure, and a real regression still has to fail twice.
- **Artifacts:** `e2e-results-${{ github.run_id }}` on every run, plus `e2e-debug-*` on failure

There is no separate coverage job in any workflow.

---

## Test Utilities & Patterns

### Overview

Located in [packages/core/src/testing/](../packages/core/src/testing/), exported from the `@usequark/quark-core/testing` subpath. Deliberately **not** re-exported from the package root, to keep them out of production import graphs.

Utilities provide:
- **Factories**, generate test data with sensible defaults
- **Mocks**, zero-dependency stand-in objects
- **Helpers**, common assertion and control-flow patterns

### Import Pattern

```js
import {
  createTestUser,
  createTestSession,
  createTestPost,
  createMockPrisma,
  createMockRequest,
  createMockResponse,
  createMockRedis,
  captureConsole,
  waitFor,
  createTestContext,
  assertThrows,
  assertApiResponse,
} from "@usequark/quark-core/testing";
```

### Factories

Generate test data with auto-populated defaults. Every factory spreads `...overrides` last, so any field can be replaced.

#### `createTestUser(overrides = {})`

Creates a plain object matching the Prisma `User` model shape.

```js
const user = createTestUser();
// → { id: "user_abc123", email: "test-xyz123@example.com", name: "Test User",
//     role: "viewer", password: null, image: null, emailVerified: null,
//     createdAt: Date, updatedAt: Date }

const admin = createTestUser({ role: "ADMIN", email: "admin@example.com" });
```

Defaults for `id`, `email`, `name`, and `role` are generated. This is an in-memory fixture: it does not touch the database.

#### `createTestSession(overrides = {})`

Creates a NextAuth-compatible session. Pass `overrides.user` to customise the embedded user.

```js
const session = createTestSession({ user: { id: "user_123", role: "admin" } });
// → { user: { id, email, name, role }, expires: ISO string 24h out }
```

#### `createTestPost(overrides = {})`

Creates a generic content object: `{ id, title, content, published, authorId, createdAt, updatedAt }`.

Quark's schema is exactly seven models (`User`, `Account`, `Session`, `VerificationToken`, `Job`, `File`, `AuditLog`). There is no `Post` model and no `post` query helper in `packages/db`. This factory exists as a ready-made fixture for blog-shaped content in your own domain: adapt it, or replace it with a factory matching your schema.

```js
const post = createTestPost({ title: "My Post", published: true });
```

### Mocks

Zero-dependency stand-ins for complex objects. All of them record calls so you can assert on interactions.

#### `createMockPrisma(overrides = {})`

Mock Prisma client. Unknown model/method combinations return `null`.

```js
const prisma = createMockPrisma();
// Or seed return values up front:
const prisma = createMockPrisma({
  user: { findUnique: { id: "123", email: "test@example.com" } },
});

prisma.mockReturn("user", "findUnique", { id: "123", email: "test@example.com" });

const user = await prisma.user.findUnique({ where: { id: "123" } });
assert.strictEqual(user.email, "test@example.com");

// Calls are recorded as { model, method, args }
assert.strictEqual(prisma.calls.length, 1);
assert.strictEqual(prisma.calls[0].model, "user");

prisma.reset(); // clears calls and seeded return values
```

#### `createMockRequest(overrides = {})`

Simulates a Next.js Request. Defaults: `method: "GET"`, `url: "http://localhost/api/test"`.

```js
const request = createMockRequest({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: { name: "John" },
  cookies: { session: "abc" },
});

assert.strictEqual(request.method, "POST");
assert.strictEqual(request.headers.get("Content-Type"), "application/json"); // case-insensitive
assert.strictEqual(request.cookies.get("session"), "abc");
assert.ok(request.nextUrl instanceof URL);
```

#### `createMockResponse()`

Simulates a Next.js `NextResponse`. `status` is a plain property (defaults to `200`), and `json()` / `redirect()` return the response for chaining.

```js
const response = createMockResponse();
response.json({ success: true });

assert.strictEqual(response.status, 200);
assert.deepStrictEqual(response.body, { success: true });
assert.strictEqual(response.headers.get("content-type"), "application/json");

const redirect = createMockResponse().redirect("/login");
assert.strictEqual(redirect.status, 302);
```

#### `createMockRedis(initialData = {})`

In-memory Redis backed by a `Map`. Supports `get`, `set`, `del`, `keys`, `expire`, `exists`, `incr`, `pipeline`, `ping`, `quit`, `disconnect`.

```js
const redis = createMockRedis({ "session:123": "data" });

await redis.set("new:key", "value");
assert.strictEqual(await redis.get("session:123"), "data");

// Every call is recorded as { method, args }
assert.ok(redis.calls.some((c) => c.method === "set"));

redis.reset(); // clears stored data and recorded calls
```

### Helpers

Common test patterns and utilities.

#### `captureConsole()`

Intercepts `console.log`, `.warn`, `.error`, `.info`, and `.debug`, recording `{ method, args }` entries. Returns `{ output, restore }`. It takes **no arguments**, and you must call `restore()`.

```js
import { createLogger } from "@usequark/quark-core";

const { output, restore } = captureConsole();

const log = createLogger({ name: "billing" });
log.info("invoice sent", { invoiceId: "inv_1" });

restore();

assert.ok(output.some((e) => e.method === "info"));
```

Useful for:
- Verifying logging behavior without polluting test output
- Asserting error messages were logged
- Ensuring a code path produced no unexpected output

Note that Quark's `createLogger()` writes through to `console`, so this helper is the supported way to assert on log output.

#### `waitFor(fn, { timeout = 5000, interval = 50 })`

Retries an assertion function until it passes or the timeout elapses. On timeout it rethrows the last error.

```js
await waitFor(
  () => assert.strictEqual(getStatus(), "ready"),
  { timeout: 2000 },
);
```

Common in:
- Async operations that eventually complete
- Eventual consistency checks
- Polling a queue or an external service

#### `createTestContext()`

Isolates environment variables and registered cleanup per test.

```js
const ctx = createTestContext();

ctx.setEnv("NODE_ENV", "test");
ctx.setEnv("API_KEY", "secret");
ctx.setEnv("MISSING", undefined); // deletes the variable

ctx.onCleanup(async () => {
  await restoreFixture();
});

// ... run test code ...

await ctx.cleanup(); // runs cleanups LIFO, then restores saved env vars
```

`restoreEnv()` restores environment variables without running cleanups.

#### `assertThrows(fn, ErrorClass, messagePattern)`

Asserts that an **async** function throws. Both `ErrorClass` and `messagePattern` are optional, and `messagePattern` accepts a string (substring match) or a RegExp. Returns the caught error.

```js
await assertThrows(
  () => createUserAction({ email: "not-an-email" }),
  ValidationError,
  /invalid email/i,
);
```

Better than try/catch because:
- Verifies exception type **and** message
- Reads like a real assertion
- Fails clearly when nothing is thrown, or the wrong type is thrown

For **synchronous** functions, use `node:assert/strict`'s own `assert.throws(fn, ErrorClass, pattern)`.

#### `assertApiResponse(response, { status, bodyIncludes })`

Asserts status code and body contents. Works with `createMockResponse()` and with real `fetch` `Response` objects that have been parsed.

```js
assertApiResponse(response, {
  status: 200,
  bodyIncludes: { success: true, userId: "123" },
});
```

---

## Database & Redis Setup

### CI Services

**PostgreSQL 16**
- Image: `postgres:16-alpine`
- Test DB: `quark_test`, user `quark_user`
- Health check: `pg_isready`, 10s interval, 5s timeout, 5 retries

**Redis 7**
- Image: `redis:7-alpine`
- Health check: `redis-cli ping`, 10s interval, 5s timeout, 5 retries

Both services are declared on the `test` job and torn down with the job.

### Local Development Setup

```bash
docker compose up -d

# Verify services are running
docker compose ps

# Create/reset database
pnpm db:generate
pnpm db:migrate

# Run tests
pnpm test

# Shut down
docker compose down
```

`docker-compose.yml` defines `postgres` and `redis`. `docker-compose.override.yml` adds `mailpit` as a local SMTP sink for development (UI on `http://localhost:8025`). Docker Compose merges the override automatically.

### Connection Patterns

`packages/db` builds its connection string from environment variables in this priority order:

1. `DATABASE_URL`, if set, used directly
2. Individual vars: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

`packages/db/src/connection.test.js` covers this behavior.

### Prisma Client Location

The Prisma generator writes to a committed source path, not into `node_modules`:

```
packages/db/prisma/schema.prisma   generator client { output = "../src/generated/prisma" }
```

So the generated client lives at `packages/db/src/generated/prisma`, and `pnpm db:generate` must run before any suite that touches the database. `turbo run test` depends on `db:generate`, which covers this automatically; running a `db` suite directly does not.

The schema is exactly seven models: `User`, `Account`, `Session`, `VerificationToken`, `Job`, `File`, `AuditLog`. Domain verticals were removed from the source schema outright. There is no trimming step and no `--full-schema` flag. Add domain models through the `add-model` skill, not by editing the schema by hand.

### Migrations in Tests

- Tests use the existing schema from `packages/db/prisma/schema.prisma`
- There is **no automatic test schema reset** between tests
- Tests that write data must clean up in `afterEach()`

```js
import { describe, test, afterEach } from "node:test";
import { prisma } from "<scope>/db";

describe("User model", () => {
  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: "test-" } },
    });
  });

  test("creates user", async () => {
    const user = await prisma.user.create({
      data: { email: "test-user@example.com" },
    });
    assert.ok(user.id);
  });
});
```

`<scope>` is your project's npm scope. In the monorepo, the private, unpublished copy of this package lives at `packages/db`; in a scaffolded project it is copied into `packages/db` and renamed to `<scope>/db`. It is never published to npm.

### Available Query Helpers

`packages/db/src/queries.js` exports helpers for the seven core models and nothing more:

`user`, `job`, `account`, `session`, `verificationToken`, `auditLog`, `file`

There is no `post` helper. Add your own domain helpers to that file as your schema grows.

---

## Coverage Strategy

### Current Approach

**Status: Optional/ad-hoc. Coverage is not enforced.**

Stated plainly, and stated once:

- No coverage threshold is enforced in CI or in any git hook
- No coverage script exists in any `package.json`
- No coverage config file exists (`.nycrc`, c8 config, `jest.config.js`, `vitest.config.js`)
- No job in any workflow produces or uploads a coverage report

This is the repo's position. Do not read a percentage anywhere in this document as a threshold.

### Measuring Coverage Ad Hoc

Node ships a coverage reporter in the test runner itself, so no new dependency is needed:

```bash
node --test --experimental-test-coverage packages/core/src/errors.test.js
```

Flags worth knowing:

```bash
# Only report files that were loaded by the tests
node --test --experimental-test-coverage --test-coverage-include='src/**/*.js' 'packages/core/src/**/*.test.js'

# Also emit an lcov report for tooling
node --test --experimental-test-coverage --test-coverage-reporter=lcov
```

Use it locally when you want a signal. Do not add a threshold script without agreeing on the number first: `packages/core` is infrastructure with heavy branching, and a naive global number would be misleading rather than useful.

---

## Best Practices

### 1. Co-locate Tests with Source

Tests live in `*.test.js` files next to the module they test.

```
src/
├── auth.js
├── auth.test.js       ← Good
├── utils.js
└── utils.test.js
```

NOT in a separate `__tests__/` folder.

### 2. Test Behavior, Not Implementation

```js
// Good: Tests what the function does
test("rejects invalid email", () => {
  assert.throws(
    () => validateEmail("not-an-email"),
    ValidationError,
    /invalid/i,
  );
});

// Bad: Tests internal implementation
test("regex matches emails", () => {
  assert.ok(emailRegex.test("user@example.com"));
  // This does not test the actual validator
});
```

### 3. Use Factories for Test Data

```js
// Good: Readable, maintainable
const user = createTestUser({ email: "admin@example.com", role: "ADMIN" });

// Bad: Brittle, easy to desync from the schema
const user = {
  id: "user_abc123",
  email: "admin@example.com",
  password: null,
  role: "ADMIN",
  createdAt: new Date(),
  // ...forgot fields...
};
```

### 4. Clean Up After Tests

```js
afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { contains: "test-" } },
  });

  mockRedis.reset();
  mockPrisma.reset();

  restoreConsole();
});
```

Prevents test pollution and flaky tests. The mocks expose `reset()` precisely so this stays cheap.

### 5. Use Descriptive Test Names

```js
// Good: Clear what is being tested
test("throws ValidationError if email is missing", () => {
  // ...
});

test("strips whitespace from email before validation", () => {
  // ...
});

// Bad: Vague
test("email works", () => {
  // ...
});

test("test email validation", () => {
  // ...
});
```

### 6. Group Related Tests

```js
describe("User validation", () => {
  describe("email", () => {
    test("rejects invalid format", () => {});
    test("strips whitespace", () => {});
    test("requires non-empty", () => {});
  });

  describe("password", () => {
    test("requires minimum 8 chars", () => {});
    test("requires an uppercase letter", () => {});
  });
});
```

### 7. Test Error Paths

```js
// Good: Tests both happy path and errors
test("returns user on valid ID", async () => {
  const user = await getUser("user_123");
  assert.ok(user);
});

test("throws NotFoundError if user does not exist", async () => {
  await assert.rejects(
    () => getUser("nonexistent"),
    NotFoundError,
  );
});

// Bad: Only tests the happy path
test("getUser works", async () => {
  const user = await getUser("user_123");
  assert.ok(user);
});
```

`NotFoundError` is exported from `@usequark/quark-core/errors` alongside `AppError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `RateLimitError`, `DatabaseError`, and `ServiceError`.

### 8. Keep Tests Fast

- Use mocks for external services (Prisma, Redis)
- Avoid unnecessary database writes (use `createMockPrisma()`)
- Push I/O into the `*.integration.test.js` tier

```js
// Good: Uses the mock, no DB I/O
const prisma = createMockPrisma();
prisma.mockReturn("user", "findUnique", { id: "123" });

// Bad: Hits the real database
await prisma.user.create({ data: { email: "..." } });
```

### 9. Document Complex Tests

```js
test("validates JWT with RS256 and matches the issuer claim", () => {
  // Complex test logic...
  // Tokens from other issuers must be rejected.
  // Issuer validation spec: RFC 7519 section 4.1.3
});
```

### 10. Respect Repo Conventions Inside Tests

Tests are allowed `console` and bare `Error`, because they are test code. The rules still apply to everything under test:

- Code that throws in app/runtime code throws `AppError` or `ValidationError`
- Code that logs uses `createLogger()` from `@usequark/quark-core`
- Test suites should import the real logger rather than reaching for `console`, so that the code under test stays production-shaped

---

## Gaps & Recommendations

### Current Gaps

1. **No coverage visibility**
   - No threshold, no report, no CI signal
   - **Impact:** Untested code paths can grow silently. The reporter is built into Node, so the gap is a process gap, not a tooling gap.

2. **No snapshot testing**
   - `node:test` has no snapshot support, and the repo has no third-party snapshot library
   - `packages/ui` asserts on class names and structure instead
   - **Impact:** Component output drift is caught by review, not by a diff.

3. **No built-in test parallelization**
   - `node --test` runs files sequentially within a process by default. Only `packages/cli` opts in, pinning its integration suites to `--test-concurrency=1`.
   - Database suites share one schema, so they cannot safely run concurrently without isolation
   - **Impact:** The `test` job is the slowest stage of CI, and turbo already parallelises across workspaces

4. **No shared integration fixtures**
   - Auth flows and API contract setup are re-written per suite
   - `createTestUser()` / `createTestSession()` cover the object shape, but not a persisted, authenticated session
   - **Impact:** Duplicated setup and inconsistent assumptions

5. **Docker service startup time**
   - The `test` job waits on Postgres and Redis health checks (10s interval, up to 5 retries)
   - **Impact:** Fixed latency before any test executes

6. **`apps/web` integration suite is separate**
   - `src/app/api/integration.test.js` is excluded from the `test` script and only runs via `pnpm test:integration`
   - No CI job, and no git hook, invokes `pnpm test:integration`. The pre-push hook runs `pnpm test`, which applies the same exclusion
   - **Impact:** This is a real blind spot. The single highest-value fix below.

### Recommendations (Priority Order)

#### P1: Wire `test:integration` into CI

`apps/web/src/app/api/integration.test.js` is the only suite in the repo that no automated job runs. Add a step to the `test` job:

```yaml
      - name: Run integration tests
        run: pnpm test:integration
```

**Where:** `.github/workflows/ci.yml`, `test` job  
**Why:** It is currently dead weight; a green pipeline says nothing about it  
**Effort:** ~15 minutes

#### P2: Add Persisted Auth Fixtures

Extend the core testing utilities with fixtures that write to the database and clean up after themselves:

```js
// packages/core/src/testing/fixtures/auth-flow.js
export async function setupAuthenticatedUser() {
  const ctx = createTestContext();
  ctx.onCleanup(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "test-" } } });
  });

  const user = await prisma.user.create({
    data: { email: `test-${randomId()}@example.com`, password: await hashPassword("correct-horse") },
  });
  const session = await prisma.session.create({ data: { /* ... */ } });

  return { user, session, cleanup: ctx.cleanup };
}
```

**Where:** `packages/core/src/testing/fixtures/`  
**Why:** Removes duplicated setup from `apps/web` and `packages/db` suites  
**Effort:** ~4-6 hours

#### P3: Introduce a Coverage Baseline

Not a threshold. A measured baseline, recorded in this document, so regressions are visible:

```bash
node --test --experimental-test-coverage --test-coverage-include='src/**/*.js' 'packages/core/src/**/*.test.js'
```

Run it once per release, write the number down here, and treat a drop as a review signal. Agree on the number before scripting anything.

**Where:** `docs/TESTING_INFRASTRUCTURE.md` (this section), CI as a comment-only step at first  
**Why:** A number nobody agreed to is theatre; a number everyone can see is useful  
**Effort:** ~1 hour to measure, ongoing to maintain

#### P4: Expand `apps/web` Route Handler Coverage

The `apps/web` tree has 26 suites and only six cover route handlers. The Server Action surface is the largest untested user-facing area:

```js
// apps/web/src/app/actions/user.test.js
test("createUser returns a validation error on invalid email", async () => {
  await assertThrows(
    () => createUserAction({ email: "invalid" }),
    ValidationError,
  );
});
```

**Where:** `apps/web/src/app/**/*.test.js`  
**Why:** Most user-facing code needs confidence  
**Effort:** ~2-3 days

#### P5: Enable Concurrency for Non-Database Suites

The CLI package already proves the pattern:

```bash
node --test --test-concurrency=4 'packages/core/src/**/*.test.js'
```

Keep DB-backed suites serial. `scripts/run-tests.mjs` is the natural place to split "unit tier" from "database tier" if this is pursued.

**Where:** `scripts/run-tests.mjs`, per-workspace `test` scripts  
**Why:** Faster CI feedback  
**Effort:** ~2 hours  
**Blocker:** Requires database schema isolation, or an explicit DB-tier exclusion list

#### P6: Consider Component Output Snapshots

Only if regressions in rendered output become a real recurring problem. `node:test` has no snapshot support, so this means adding a dependency, which currently contradicts the repo's minimal-dependency stance. Treat it as an explicit decision, not a default.

**Effort:** ~6-8 hours (choose library, integrate, write baselines, review diffs)

#### Already Done: Git Hook Coverage

Pre-commit runs Biome plus template sync. Pre-push runs the changeset check plus `pnpm test`. Nothing to add here; see [Git Hooks](#git-hooks).

---

## Related Documentation

- [Architecture Decision Records](./adr/README.md)
  - [ADR-002: No TypeScript](./adr/002-no-typescript.md), philosophy on simplicity
  - [ADR-005: BullMQ Job Queue](./adr/005-bullmq-job-queue.md), job testing patterns
- [AGENTS.md](../AGENTS.md), coding conventions, error handling, logging
- [CONTRIBUTING.md](../CONTRIBUTING.md), contribution guidelines
- [DATABASE.md](./DATABASE.md), Prisma schema, migrations, connection
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md), common test failures and fixes

---

## Maintenance & Updates

This document should be updated when:
- New test files are added or removed (re-run the `find` commands in [How These Counts Were Measured](#how-these-counts-were-measured))
- A test script is added, removed, or renamed in any `package.json`
- The CI workflow changes
- New utilities are added to `packages/core/src/testing/`
- The coverage position changes

**Last verified:** October 7, 2026  
**Maintainer:** See [CONTRIBUTING.md](../CONTRIBUTING.md)