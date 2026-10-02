# Quark Testing Infrastructure Report

**Last Updated:** March 29, 2026  
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

Quark uses a **lightweight, dependency-free testing approach** built on Node.js native test runner (`node --test`). The monorepo contains **~70 test files** across 8 packages/apps, with **no external test frameworks** (Jest, Vitest, Mocha). Testing is **CI-integrated** via GitHub Actions with real PostgreSQL 16 and Redis 7 services.

### Key Characteristics

| Aspect | Value |
|--------|-------|
| **Framework** | Node.js native `node:test` |
| **Total Test Files** | ~70 across monorepo |
| **Assertion Library** | `node:assert/strict` |
| **Most Tested Package** | `@techstream/quark-core` (21 test files) |
| **CI Services** | PostgreSQL 16, Redis 7 (health checks) |
| **Root Command** | `pnpm test` → `turbo run test` |
| **Coverage** | Optional/ad-hoc (not enforced) |
| **Test Naming** | `*.test.js` co-located with source |

---

## Testing Architecture

### Why Node.js Native Test Runner?

- **Zero external dependencies** - aligns with Quark's ESM-only, minimal-dependency philosophy
- **Built-in to Node 18+** - no additional install surface
- **Fast startup** - native runner vs. Jest/Vitest bootstrap overhead
- **Clear assertions** - `node:assert/strict` catches subtle bugs
- **Familiar pattern** - `describe()`, `test()`, `beforeEach()`, `afterEach()`

See [ADR-002: No TypeScript](docs/adr/002-no-typescript.md) for Quark's philosophy on simplicity.

### Test Organization Model

```
packages/*/src/
├── module.js
├── module.test.js          ← Co-located test file
package.json
├── "test": "node --test $(find src -name '*.test.js')"
```

**Benefits:**
- Tests live next to source → easier to keep in sync
- Clear 1:1 mapping between module and test
- IDEs can easily navigate between them

### Assertion Style

```js
import assert from "node:assert/strict";
import { describe, test } from "node:test";

describe("User model", () => {
  test("creates user with valid email", () => {
    const user = createUser({ email: "test@example.com" });
    assert.strictEqual(user.email, "test@example.com");
    assert.ok(user.id); // Non-null check
  });

  test("throws on invalid email", () => {
    assert.throws(
      () => createUser({ email: "invalid" }),
      ValidationError,
      /invalid email format/i
    );
  });
});
```

---

## Test Organization & Files

### Breakdown by Package

#### `packages/core/` - **21 test files** (Most comprehensive)

Core library contains infrastructure tests for auth, caching, queuing, logging, rate limiting, etc.

| Module | Test File | Purpose |
|--------|-----------|---------|
| Auth | `auth.test.js` | JWT verification, session validation |
| CSRF | `csrf.test.js` | Token generation, protection validation |
| Cache | `cache.test.js` | Caching behavior, TTL expiration |
| Queue | `queue/queue.test.js` | Job definitions, retries, deduplication |
| Email | `email.test.js` | Mailpit integration, template rendering |
| Logger | `logger.test.js` | Output levels, formatting, structured logs |
| Redis | `redis.test.js` | Connection pooling, command execution |
| Metrics | `metrics.test.js` | Counter/gauge/histogram recording |
| Storage | `storage.test.js` | S3-compatible uploads, URL generation |
| Rate Limiter | `rate-limiter.test.js` | Token bucket implementation |
| Pagination | `pagination.test.js` | Cursor/offset logic, boundary cases |
| Query Builder | `query-builder.test.js` | SQL generation, parameter binding |
| Multipart | `multipart.test.js` | File upload parsing |
| Error Reporting | `error-reporter.test.js` | Error capture, stack traces |
| Authorization | `authorization.test.js` | Role-based access control (RBAC) |
| Errors | `errors.test.js` | AppError, ValidationError classes |
| Utils | `utils.test.js` | Helpers, transformations |
| File Validation | `file-validation.test.js` | MIME types, size limits |
| Email Templates | `email-templates.test.js` | Template compilation, variable substitution |
| Request Logger | `request-logger.test.js` | HTTP middleware logging |
| Testing Utilities | `testing/testing.test.js` | Mock/factory functions |

#### `packages/ui/` - **13 test files** (Component tests)

Server Component-safe primitives tested for:
- Prop validation
- Accessibility attributes (ARIA)
- Tailwind class application
- Optional overrides via `className`

Components: Button, Input, Checkbox, Label, Table, Select, Badge, Card, Dialog, Toast, Textarea, Rich-Text, Skeleton

#### `packages/config/` - **4 test files**

| Test File | Purpose |
|-----------|---------|
| `index.test.js` | Config object creation |
| `environment.test.js` | Env var validation, Zod schemas |
| `load-config.test.js` | Configuration loading order |
| `app-url.test.js` | URL formatting logic |

#### `packages/db/` - **2 test files**

| Test File | Purpose |
|-----------|---------|
| `connection.test.js` | Prisma client initialization, env var priority |
| `queries.test.js` | Database query assertions |

#### `packages/admin/` - **2 test files**

| Test File | Purpose |
|-----------|---------|
| `introspect.test.js` | Prisma schema introspection |
| `field-map.test.js` | Admin field type mapping |

#### `packages/jobs/` - **1 test file**

| Test File | Purpose |
|-----------|---------|
| `definitions.test.js` | Job type definitions, serialization |

#### `packages/cli/` - **1 unit test + custom CLI tests**

| Test | Purpose |
|------|---------|
| `utils.test.js` | String transformations, path utils |
| `test-cli.js` | Custom E2E test for scaffold generation |
| `test-build.js`, `test-e2e*.js`, `test-integration.js` | Specialized CLI test scripts |

#### `apps/worker/` - **1 test file**

| Test File | Purpose |
|-----------|---------|
| `index.test.js` | BullMQ job handler registration |

#### `apps/web/` - **4 tests (limited coverage)**

| Test File | Purpose |
|-----------|---------|
| `manifest.test.js` | Web manifest validity |
| `page.test.js` | Home page rendering |
| `indexing.test.js` | SEO metadata |
| `integration.test.js` | Separate E2E suite (see [Running Tests](#running-tests)) |

---

## Testing Frameworks & Libraries

### Node.js Native Test Runner

**Module:** `node:test`  
**Assertion:** `node:assert/strict`  
**Version:** Available in Node 18+; Quark requires Node 22+ ([package.json engines](package.json))

```js
import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("Module", () => {
  test("does something", () => {
    assert.strictEqual(actual, expected);
  });
});
```

### Why No Jest/Vitest?

1. **Zero dependency footprint** - reduces supply chain risk
2. **Faster CI startup** - native runner bootstraps instantly
3. **Alignment with architecture** - Quark minimizes dependencies throughout
4. **Good enough for monorepo** - native test runner covers 90% of use cases

**Trade-offs:**
- No built-in: snapshot testing, parallel test isolation, advanced mocking
- Workaround: Use [`createMockPrisma()`](#test-utilities--patterns) and [`captureConsole()`](#test-utilities--patterns) for common needs

---

## Running Tests

### Local Development

#### Run All Tests

```bash
pnpm test
```

Runs `turbo run test` - executes test scripts across all packages sequentially, stops on first failure.

#### Run Tests for Specific Package

```bash
# Test core library
pnpm --filter @techstream/quark-core test

# Test web app
pnpm --filter @techstream/quark-web test

# Test worker
pnpm --filter @techstream/quark-worker test
```

#### Run Tests in Watch Mode

Watch mode is not built into `node:test`, but can be done with `nodemon`:

```bash
npx nodemon --watch packages/core/src --ext js --exec "pnpm --filter @techstream/quark-core test"
```

Or use file system watchers in your IDE.

#### Run Specific Test File

```bash
node --test packages/core/src/auth.test.js
```

#### Run Tests Matching a Pattern

```bash
# Run all rate limiter tests
node --test --grep "rate.*limit" packages/core/src/rate-limiter.test.js
```

### CLI-Specific Tests

The CLI package has custom test commands adapted to its multi-template structure:

```bash
# Unit tests only
pnpm --filter @techstream/quark-create-app test

# CLI generation test
pnpm --filter @techstream/quark-create-app test:cli

# Lightweight E2E (generation + build check)
pnpm --filter @techstream/quark-create-app test:e2e

# Full E2E with Docker services
pnpm --filter @techstream/quark-create-app test:e2e:full

# Run all CLI tests
pnpm --filter @techstream/quark-create-app test:all
```

See [packages/cli/README.md](packages/cli/README.md) for details.

### Prerequisites

Tests requiring persistent services (Postgres, Redis) need them running:

```bash
# Start services
docker compose up -d

# Run tests
pnpm test

# Clean up
docker compose down
```

**Environment variables** for local testing are in [.env.example](.env.example):
```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=quark_dev
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## CI/CD Testing Workflow

### Continuous Integration Pipeline

Defined in [.github/workflows/ci.yml](.github/workflows/ci.yml):

```
┌─────────────────────────────────────────────────────────────┐
│ trigger: push (main + PRs) OR manual dispatch               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Job 1: LINT (all platforms, Node 22)                        │
│ - Biome format check                                        │
│ - Biome lint                                                │
│ Run time: ~1-2 min                                          │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Job 2: TEMPLATE-DRIFT (checks CLI scaffold sync)            │
│ - Verify templates match source                             │
│ - Auto-commit fixes to main                                 │
│ Run time: ~1-2 min                                          │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Job 3: TEST + SERVICES (ubuntu-latest, Node 22)            │
│ Services:                                                   │
│   - PostgreSQL 16 (quark_test DB)                          │
│   - Redis 7                                                │
│   - Health checks via pg_isready, redis-cli ping           │
│ Run: pnpm test                                             │
│ Env: POSTGRES_USER, POSTGRES_PASSWORD, etc. from secrets   │
│ Run time: ~3-5 min for all packages                        │
│ Failed tests stop the pipeline                             │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Job 4: BUILD (depends on lint + test + template-drift)   │
│ - pnpm build                                               │
│ - All monorepo packages                                    │
│ Run time: ~2-3 min                                         │
└──────────────────────────────────────────────────────────────┘
                          ↓
               ✓ All checks passed
```

### Workflow Details

| Job | Command | Depends On | Triggers | Services |
|-----|---------|------------|----------|----------|
| **Lint** | `pnpm lint` | - | Push, PR | None |
| **Template Drift** | `pnpm sync-templates:check` | - | Push, PR | None |
| **Test** | `pnpm test` | lint, template-drift | Push, PR | Postgres 16, Redis 7 |
| **Build** | `pnpm build` | lint, template-drift, test | Push, PR | None |

### Test Environment Variables

CI provides test-specific credentials ([.github/workflows/ci.yml](/.github/workflows/ci.yml#L100)):

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
  NODE_ENV: test
```

### CLI E2E Workflow

Separate CI job for full E2E testing of scaffold generation:

**Workflow:** [.github/workflows/cli-e2e-full.yml](.github/workflows/cli-e2e-full.yml)

- **Trigger:** Changes to `packages/cli/` or manual dispatch
- **Command:** `pnpm --filter @techstream/quark-create-app test:e2e:full`
- **Artifacts:** E2E results + debug logs on failure
- **Timeout:** 20 minutes

---

## Test Utilities & Patterns

### Overview

Located in [packages/core/src/testing/](packages/core/src/testing/), exported from `@techstream/quark-core/testing`.

Utilities provide:
- **Factories** - Generate test data with sensible defaults
- **Mocks** - Zero-dependency stand-in objects
- **Helpers** - Common assertion and control-flow patterns

### Import Pattern

```js
import {
  createTestUser,
  createMockPrisma,
  captureConsole,
  waitFor,
} from "@techstream/quark-core/testing";
```

### Factories

Generate test data with auto-populated defaults:

#### `createTestUser(overrides = {})`

Creates a user record matching your Prisma schema.

```js
// Minimal
const user = createTestUser();
// → { id: "user_abc123", email: "test_xyz@example.com", ... }

// Override specific fields
const admin = createTestUser({ role: "ADMIN", email: "admin@app.com" });
```

#### `createTestSession(overrides = {})`

Creates a NextAuth session object.

```js
const session = createTestSession({ userId: "user_123" });
// → { user: { id: "user_123", email: "..." }, expires: "2026-03..." }
```

#### `createTestPost(overrides = {})`

Creates a sample post/content object (adapt based on your schema).

```js
const post = createTestPost({ title: "My Post", published: true });
```

### Mocks

Zero-dependency stand-ins for complex objects. Call methods and check invocations.

#### `createMockPrisma(overrides = {})`

Mock Prisma client for database-independent tests.

```js
const mockPrisma = createMockPrisma({
  user: {
    findUnique: async () => ({ id: "123", email: "test@example.com" }),
  },
});

// In test
const user = await mockPrisma.user.findUnique();
assert.strictEqual(user.email, "test@example.com");

// Verify call count/args (if tracking enabled)
const calls = mockPrisma.user.findUnique.calls();
assert.strictEqual(calls.length, 1);
```

#### `createMockRequest(overrides = {})`

Simulates a Next.js Request object.

```js
const request = createMockRequest({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: { name: "John" },
});

assert.strictEqual(request.method, "POST");
```

#### `createMockResponse()`

Simulates a Next.js Response object with `.json()`, `.status()`, etc.

```js
const response = createMockResponse();
response.status(200).json({ success: true });

assert.strictEqual(response.statusCode, 200);
assert.deepStrictEqual(response.body, { success: true });
```

#### `createMockRedis(initialData = {})`

In-memory Redis replacement.

```js
const redis = createMockRedis({ "session:123": "data" });

await redis.get("session:123"); // → "data"
await redis.set("new:key", "value");
```

### Helpers

Common test patterns and utilities.

#### `captureConsole(fn, { level = "all" })`

Intercept console output during test execution.

```js
const { logs, warns, errors } = captureConsole(() => {
  console.log("Test message");
  console.warn("Warning");
  console.error("Error");
});

assert.deepStrictEqual(logs, ["Test message"]);
assert.deepStrictEqual(warns, ["Warning"]);
```

Useful for:
- Verifying logging behavior without side effects
- Testing error messages
- Ensuring no unexpected console output

#### `waitFor(fn, { timeout = 5000, interval = 100 })`

Retry an assertion until it passes or timeout.

```js
let value = 0;
setTimeout(() => { value = 42; }, 500);

// This will keep retrying until value equals 42 or 5s passes
await waitFor(() => assert.strictEqual(value, 42));
```

Common in:
- Async operations that eventually complete
- Tests checking eventual consistency
- Timing-sensitive scenarios

#### `createTestContext()`

Isolate environment variables per test.

```js
const ctx = createTestContext();

// Set test-specific env
ctx.env.NODE_ENV = "test";
ctx.env.SECRET_KEY = "test-key";

// Run test code
// ...

// Cleanup happens automatically or on ctx.cleanup()
ctx.cleanup();
```

#### `assertThrows(fn, ErrorClass, messagePattern)`

Verify function throws correct error type with matching message.

```js
const fn = () => {
  throw new ValidationError("Email is invalid");
};

assertThrows(fn, ValidationError, /email/i);
// ✓ Passes
```

Better than try/catch because:
- Verifies both exception type AND message
- Reads like a real assertion
- Fails clearly if wrong exception or no exception

#### `assertApiResponse(response, { status, bodyIncludes })`

Validate API response properties.

```js
assertApiResponse(response, {
  status: 200,
  bodyIncludes: { success: true, userId: "123" },
});
// Asserts response.status === 200 AND responds body matches
```

---

## Database & Redis Setup

### CI Services

**PostgreSQL 16**
- Image: `postgres:16-alpine`
- Test DB: `quark_test`
- User: `quark_user` (from CI secret)
- Health check: `pg_isready` (waits for readiness)

**Redis 7**
- Image: `redis:7-alpine`
- Health check: `redis-cli ping`

Both are spun up before tests run and torn down after.

### Local Development Setup

Start services with Docker Compose:

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

### Connection Patterns

Tests connect via environment variables (priority order):

1. `DATABASE_URL` (if set, used directly)
2. Individual vars: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

**Example:** `packages/db/src/connection.test.js` verifies this behavior.

### Migrations in Tests

- Tests use the existing schema from `packages/db/prisma/schema.prisma`
- No automatic test schema reset between tests (currently)
- Tests that modify data should clean up in `afterEach()`

```js
import { describe, test, afterEach } from "node:test";
import { prisma } from "@techstream/quark-db";

describe("User model", () => {
  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: "test-" } },
    });
  });

  test("creates user", async () => {
    const user = await prisma.user.create({
      data: { email: "test-user@example.com" },
    });
    // Test assertions...
  });
});
```

---

## Coverage Strategy

### Current Approach

**Status:** Optional/ad-hoc

- No coverage threshold enforced in CI
- No `.nycrc`, `jest.config.js`, or `vitest.config.js`
- Coverage folders exist but tracked in `.gitignore`
- Developers can generate coverage locally

### Generating Coverage

While native `node:test` doesn't have built-in coverage, you can use third-party tools:

#### Option 1: Use c8 (Recommended)

```bash
# Install
npm install --save-dev c8

# Run
c8 node --test "packages/core/src/**/*.test.js"

# Output: ./coverage/ directory with HTML report
open coverage/index.html
```

#### Option 2: Use TypeScript Coverage (if migrating)

Jest/Vitest coverage would be available if you switched frameworks, but aligns against Quark's ADRs.

### Recommended Coverage Strategy

Add optional enforcement per package:

```json
{
  "scripts": {
    "test:coverage": "c8 --lines 80 --branches 70 node --test ..."
  }
}
```

This keeps coverage optional but makes it easy to measure per-package health.

---

## Best Practices

### 1. Co-locate Tests with Source

Tests live in `*.test.js` files next to the module they test.

```
src/
├── auth.js
├── auth.test.js       ← ✓ Good
├── utils.js
└── utils.test.js
```

NOT in a separate `__tests__/` folder.

### 2. Test Behavior, Not Implementation

```js
// ✓ Good: Tests what the function does
test("rejects invalid email", () => {
  assert.throws(
    () => validateEmail("not-an-email"),
    ValidationError,
    /invalid/i
  );
});

// ✗ Bad: Tests internal implementation
test("regex matches emails", () => {
  assert.ok(emailRegex.test("user@example.com"));
  // This doesn't test the actual validator
});
```

### 3. Use Factories for Test Data

```js
// ✓ Good: Readable, maintainable
const user = createTestUser({ email: "admin@example.com", role: "ADMIN" });

// ✗ Bad: Brittle, easy to desync from schema
const user = {
  id: "user_abc123",
  email: "admin@example.com",
  password: "hashed",
  role: "ADMIN",
  createdAt: new Date(),
  // ...forgot fields...
};
```

### 4. Clean Up After Tests

```js
afterEach(async () => {
  // Delete test data
  await prisma.user.deleteMany({
    where: { email: { contains: "test-" } },
  });

  // Reset mocks
  mockRedis.clear();

  // Restore console
  restore();
});
```

Prevents test pollution and flaky tests.

### 5. Use Descriptive Test Names

```js
// ✓ Good: Clear what's being tested
test("throws ValidationError if email is missing", () => {
  // ...
});

test("strips whitespace from email before validation", () => {
  // ...
});

// ✗ Bad: Vague
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
    test("requires uppercase letter", () => {});
  });
});
```

### 7. Test Error Paths

```js
// ✓ Good: Tests both happy path and errors
test("returns user on valid ID", async () => {
  const user = await getUser("user_123");
  assert.ok(user);
});

test("throws NotFoundError if user does not exist", async () => {
  assert.rejects(
    () => getUser("nonexistent"),
    NotFoundError
  );
});

// ✗ Bad: Only tests the happy path
test("getUser works", async () => {
  const user = await getUser("user_123");
  assert.ok(user);
});
```

### 8. Keep Tests Fast

- Use mocks for external services (Prisma, Redis)
- Avoid unnecessary database writes (use [`createMockPrisma()`](#mocks))
- Run tests in parallel where possible

```js
// ✓ Good: Uses mock, no DB I/O
const mockDb = createMockPrisma({
  user: { findUnique: async () => ({ id: "123" }) },
});

// ✗ Bad: Hits real database
await prisma.user.create({ data: { email: "..." } });
```

### 9. Document Complex Tests

```js
test("validates JWT with RS256 algorithm and matches issuer claim", () => {
  // Complex test logic...
  // This test ensures tokens from other issuers are rejected
  // See RFC 7519 section 4.1.3 for issuer validation spec
});
```

### 10. Use Snapshot Testing Sparingly

Native `node:test` doesn't support snapshots, but if adding them:
- Only for tests where output is genuinely complex and stable
- Review snapshot diffs carefully in PRs
- Don't use snapshots for behavioral tests

---

## Gaps & Recommendations

### Current Gaps

1. **No Coverage Threshold Enforcement**
   - Coverage reports generated but not checked in CI
   - No enforcement of minimum coverage percentage
   - **Impact:** Risk of untested code paths growing silently

2. **Limited Web App Tests**
   - `apps/web/` has only 4 basic tests
   - No Server Action tests, route handler tests, or critical path E2E
   - **Impact:** Deployments may introduce bugs in user-facing code

3. **Snapshot Testing Not Available**
   - Component output can drift without detection
   - UI tests rely on manual inspection
   - **Impact:** Harder to catch regressions in component output

4. **No Built-in Test Parallelization**
   - `node --test` runs sequentially by default
   - Database tests can't run in parallel without schema isolation
   - **Impact:** CI test job takes 3-5 minutes for available parallelization

5. **Docker Service Startup Time**
   - CI waits for health checks on Postgres/Redis (~10-30s)
   - Sequential test job waiting for services contributes to CI overhead
   - **Impact:** Slower feedback loop

6. **Limited Integration Test Coverage**
   - Integration tests exist but scattered
   - No test fixtures for common scenarios (auth flows, API contracts)
   - **Impact:** Missing coverage for feature interactions

### Recommendations (Priority Order)

#### P1: Enforce Coverage Thresholds

Add coverage enforcement to critical packages:

```json
{
  "scripts": {
    "test:coverage": "c8 --lines 80 --branches 70 --functions 80 node --test ..."
  }
}
```

**Where:** `packages/core/`, `packages/db/`, `packages/config/`  
**Why:** Core infrastructure needs high confidence  
**Effort:** ~1 hour (install c8, add config, update CI)

#### P2: Expand Web App Test Coverage

Add tests for critical Server Action and route handler paths:

```js
// apps/web/src/app/actions/user.test.js
test("createUser returns validation error on invalid email", async () => {
  const result = await createUserAction({ email: "invalid" });
  assert.strictEqual(result.error, "VALIDATION_ERROR");
});
```

**Where:** `apps/web/src/app/**/*.test.js`  
**Why:** Most user-facing code needs confidence  
**Effort:** ~2-3 days (write tests for critical paths)

#### P3: Add Integration Test Fixtures

Create reusable test fixtures for common scenarios:

```js
// packages/core/src/testing/fixtures/auth-flow.test.js
export async function setupAuthenticatedUser() {
  const user = await createTestUser();
  const session = await createTestSession({ userId: user.id });
  return { user, session };
}
```

**Where:** `packages/core/src/testing/fixtures/`  
**Why:** Reduces test duplication, ensures consistency  
**Effort:** ~4-6 hours

#### P4: Enable Test Parallelization

Quark's Node 22 baseline supports `--test --concurrency`:

```bash
node --test --concurrency 4 src/**/*.test.js
```

**Where:** Update test scripts in `package.json`  
**Why:** Faster CI feedback, especially for `packages/core/`  
**Effort:** ~2 hours (test, verify no conflicts)  
**Blocker:** Requires database schema isolation per test runner

#### P5: Add Snapshot Testing for Components

Integrate lightweight snapshot library:

```bash
npm install --save-dev snap-shot-it
```

```js
import { snapshot } from "snap-shot-it";

test("renders Button with theme", () => {
  const html = renderButton({ theme: "dark" });
  snapshot(html);
});
```

**Where:** `packages/ui/src/**/*.test.js`  
**Why:** Catch unintended component output changes  
**Effort:** ~6-8 hours (choose library, integrate, write snapshots)

#### P6: Pre-commit Hook for Tests

Add Husky to prevent commits with failing tests:

```bash
pnpm install --save-dev husky lint-staged
husky install
npx husky add .husky/pre-commit "pnpm test"
```

**Where:** Root `.husky/pre-commit`  
**Why:** Catch failures before pushing, faster feedback  
**Effort:** ~30 minutes

---

## Related Documentation

- [Architecture Decision Records](docs/adr/README.md)
  - [ADR-002: No TypeScript](docs/adr/002-no-typescript.md) - philosophy on simplicity
  - [ADR-005: BullMQ Job Queue](docs/adr/005-bullmq-job-queue.md) - job testing patterns
- [Contributing Guidelines](CLAUDE.md) - coding conventions, linting, error handling
- [Database Documentation](DATABASE.md) - Prisma schema, migrations, connection
- [CI/CD Reference](https://github.com/usequark/quark/blob/main/.github/workflows/ci.yml) - Complete workflow definition
- [Troubleshooting](TROUBLESHOOTING.md) - Common test failures and fixes

---

## Maintenance & Updates

This document should be updated when:
- New test files added or removed
- Testing framework or tools change
- CI workflow changes
- New utilities added to `packages/core/src/testing/`
- Coverage strategy changes

**Last verified:** March 29, 2026  
**Maintainer:** See CONTRIBUTORS.md
