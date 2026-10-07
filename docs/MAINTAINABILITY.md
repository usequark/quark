# Quark Maintainability Guide

## Overview

This document provides guidelines and best practices for maintaining projects built on Quark, whether you are working inside the Quark monorepo or inside a project scaffolded from it. Following these practices ensures long-term code health, reduces technical debt, and improves developer experience across teams.

Every claim in this document is checked against the repo. Where something does not exist, this document says so rather than describing it.

---

## Table of Contents

1. [Code Organization](#code-organization)
2. [Dependency Management](#dependency-management)
3. [Testing Strategy](#testing-strategy)
4. [Code Quality](#code-quality)
5. [Documentation](#documentation)
6. [Version Control](#version-control)
7. [Monitoring & Observability](#monitoring--observability)
8. [Refactoring Guidelines](#refactoring-guidelines)
9. [Technical Debt Management](#technical-debt-management)
10. [Upgrade Strategy](#upgrade-strategy)

---

## Code Organization

### The Two-Package Rule

Only **two** packages in the whole monorepo are published to npm:

| Package | Version | Published |
|---------|---------|-----------|
| `@usequark/quark-core` | 2.6.0 | yes |
| `@usequark/quark-create-app` | 1.25.4 | yes |

Everything else is **scaffolded into your project** and scoped to your npm scope. In the monorepo these four packages exist for testing and template generation; they are `private: true` and never reach npm.

| Workspace | Becomes in your project | Published |
|-----------|-------------------------|-----------|
| `packages/db` | `<scope>/db` | no |
| `packages/config` | `<scope>/config` | no |
| `packages/ui` | `<scope>/ui` | no |
| `packages/jobs` | `<scope>/jobs` | no |

There are **four** such scaffolded packages. `db`, `config`, and `ui` are always scaffolded (`REQUIRED_PACKAGES` in `packages/cli/src/index.js`). `jobs` is optional.

There is no admin package. There are no published database, UI, jobs, or config packages.

### Package Structure

Each package follows a consistent structure:

```
packages/example/
├── package.json          # Package manifest
├── src/
│   ├── index.js          # Public API exports (barrel)
│   ├── feature.js        # Feature implementation
│   └── feature.test.js   # Co-located tests
└── README.md
```

There is no committed `coverage/` directory. Coverage is measured ad hoc with Node's built-in reporter and is not tracked in git.

### Separation of Concerns

| Package | Responsibility | Should NOT Contain |
|---------|---------------|-------------------|
| `<scope>/config` | App configuration, environment variables | Business logic, UI code |
| `<scope>/db` | Database client, query helpers, Prisma schema | HTTP handlers, UI code |
| `<scope>/jobs` | Job queue definitions | Database queries, UI code |
| `<scope>/ui` | Reusable UI components | Business logic, API calls |

### Import Guidelines

Always import through the package's barrel:

```javascript
// Good: import from the public API
import { Button } from "<scope>/ui";
import { prisma, user } from "<scope>/db";

// Bad: deep imports bypass the public API
import { Button } from "<scope>/ui/src/button";
import { prisma } from "<scope>/db/src/client";
```

One real exception: the generated Prisma client is imported by its generated path, because it is not part of the hand-written public API.

```javascript
// packages/db/src/client.js
import { PrismaClient } from "./generated/prisma/client.ts";
```

That file is emitted by `prisma generate` into `packages/db/src/generated/prisma` (the generator's `output` in `schema.prisma`). It is a `.ts` artifact, which is allowed because generated code may emit typed files. Do not hand-edit it and do not import anything else from it.

### Barrel Exports

Each package has an `index.js` that exports its public API. `packages/ui/src/index.js` is the authoritative list of UI modules, and it has 24 entries:

```
badge, button, card, checkbox, container, dialog, error-banner, footer, form-field,
input, label, lightbox, logo, navbar, password-input, rich-text, select, skeleton,
spinner, table, textarea, theme, theme-constants, toast
```

`packages/ui/src/index.js` is the source of truth. Read it before adding an import.

### Generated Templates

`packages/cli/templates/` is **generated from monorepo source**. Never edit files there directly; your change will be overwritten.

After changing any source file in `apps/web/`, `apps/worker/`, `packages/db/`, `packages/config/`, `packages/ui/`, or `packages/jobs/`:

```bash
pnpm --filter @usequark/quark-create-app sync-templates
```

CI fails on template drift by diffing `packages/cli/templates/`. Run `pnpm --filter @usequark/quark-create-app sync-templates:check` locally before pushing.

---

## Dependency Management

### Internal Dependencies

Use the workspace protocol for internal packages. Inside the monorepo the four scaffolded packages keep their `@usequark/` names; in a scaffolded project the CLI rewrites them to your scope.

In a scaffolded project, internal edges use the workspace protocol and your scope:

```json
{
  "dependencies": {
    "@usequark/quark-core": "workspace:*",
    "@<scope>/db": "workspace:*",
    "@<scope>/ui": "workspace:*"
  }
}
```

Only `@usequark/quark-core` is a published dependency in that list. The scoped packages resolve from the workspace, never from npm.

Inside the monorepo itself the equivalent `package.json` files name those private workspace packages under the org namespace, for example `@usequark/quark-db` and `@usequark/quark-ui`, and mark them `"private": true`. Those names are monorepo-internal. Do not put them in a scaffolded project: the CLI rewrites them to your scope, and nothing named that exists on npm.

### External Dependencies

#### Shared Dependencies

Place shared tooling in the root `package.json`:

- Testing: Node's built-in runner, no package
- Linting and formatting: `@biomejs/biome` (`^2.5.14`)
- Task orchestration: `turbo` (`^2.11.4`)
- Changesets: `@changesets/cli` (`^3.0.3`)

#### Package-Specific Dependencies

Place runtime dependencies in the package's own `package.json`. Prisma is the current example of the versions in use:

```json
// packages/db/package.json
{
  "dependencies": {
    "@prisma/adapter-pg": "^7.10.0",
    "@prisma/client": "^7.10.0",
    "pg": "^8.23.0",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "prisma": "^7.10.0"
  }
}
```

Key versions as of this document's last verification:

| Tool | Version | Source |
|------|---------|--------|
| Prisma / `@prisma/client` | `^7.10.0` | `packages/db`, `apps/web` |
| Next.js | `16.3.6` | `apps/web` |
| React / React DOM | `19.3.0` | `apps/web` |
| BullMQ | `^6.3.8` | `packages/core`, `packages/jobs`, `apps/worker` |
| Zod | `^4.6.5` | `packages/db`, `apps/web` |
| Node engines | `>=22.13.0` | root `package.json` |
| pnpm | `10.12.1` | root `package.json` (`packageManager`) |
| Biome | `^2.5.14` | root `package.json` |

### Dependency Updates

1. **Weekly**: Review Dependabot PRs for security updates. `.github/workflows/dependabot-auto-merge.yml` exists and the CLI package has a `dependabot-config.test.js` guarding its generated config.
2. **Monthly**: Audit and update minor versions
3. **Quarterly**: Evaluate major version upgrades

#### Update Command

```bash
# Check for outdated packages
pnpm outdated

# Update all packages interactively
pnpm update --interactive --latest

# Update a specific package across the workspace
pnpm update <package> --recursive
```

### Avoiding Dependency Bloat

- Prefer built-in Node.js APIs over external packages
- Audit bundle size impact before adding new dependencies
- Use `pnpm why <package>` to understand dependency trees
- Remove unused dependencies regularly
- There is no ESLint and no Prettier. Biome handles both linting and formatting

---

## Testing Strategy

Full detail lives in [TESTING_INFRASTRUCTURE.md](./TESTING_INFRASTRUCTURE.md). This section is the summary.

### Test Pyramid

There is no browser automation layer, so the pyramid has two tiers, not three:

```
         /\
        /  \        Integration tests (*.integration.test.js)
       /----\       - Real database queries
      /      \      - CLI deploy adapters (serial: --test-concurrency=1)
     /--------\     - UI integration-test.js (jsdom + react-dom)
    /          \    Unit tests (*.test.js)
   /------------\   - Components, utilities, route handlers
  /              \  - Errors, logging, queue, storage
```

Measured with `find . -name "*.test.js" -not -path "*/node_modules/*" -not -path "*/.next/*" | wc -l`:

| Location | Count |
|----------|-------|
| `packages/core` | 27 |
| `apps/web` | 26 |
| `packages/ui` | 20 |
| `packages/cli` | 15 |
| `packages/db` | 4 |
| `packages/config` | 4 |
| `apps/worker` | 3 |
| `packages/jobs` | 1 |
| **Live total** | **100** |
| `docs/archive/reference` | 30 |
| **Repo-wide total** | **130** |

There are 3 additional `*.test.mjs` suites under `scripts/`.

### Test Organization

Co-locate tests with source files, named `*.test.js`:

```
src/
├── button.js
└── button.test.js      # Unit tests
```

There are no `.stories.js` files and no component explorer. Visual and structural checks are assertion-based, in `button.test.js`-style suites.

### Coverage Requirements

**There are none. Coverage is not enforced.**

| | |
|---|---|
| Threshold in CI | none |
| Threshold in git hooks | none |
| `test:coverage` script | does not exist, in any package |
| Coverage config file | does not exist |
| Coverage in any workflow | none |

Do not quote a minimum percentage as if it were policy. If you want a signal, use Node's built-in reporter ad hoc:

```bash
node --test --experimental-test-coverage --test-coverage-include='src/**/*.js' 'packages/core/src/**/*.test.js'
```

Proposing an enforced number is a separate discussion that needs agreement on the number first.

### Running Tests

```bash
# Run all tests (root: node --test 'scripts/*.test.mjs' && turbo run test)
pnpm test

# Run the web app integration suite, which pnpm test deliberately excludes
pnpm test:integration

# Run a specific workspace
pnpm --filter @usequark/quark-core test

# Run a single file
node --test packages/core/src/errors.test.js

# Watch mode: no script exists, use Node's watcher
node --watch --test packages/core/src/errors.test.js
```

The CLI package has its own harness, exposed through these scripts:

```bash
pnpm --filter @usequark/quark-create-app test
pnpm --filter @usequark/quark-create-app test:build
pnpm --filter @usequark/quark-create-app test:e2e
pnpm --filter @usequark/quark-create-app test:e2e:full
pnpm --filter @usequark/quark-create-app test:integration
pnpm --filter @usequark/quark-create-app test:flags
pnpm --filter @usequark/quark-create-app test:all
pnpm --filter @usequark/quark-create-app check:perf
```

There is no `test:cli` script. The `test` script already begins with `node test-cli.js`.

### Test Naming Conventions

Use `node:test`'s `test()`, not `it()`:

```javascript
import { describe, test } from "node:test";

describe("Button", () => {
  test("renders with default variant", () => {});
  test("applies secondary variant styles", () => {});
  test("disables interaction when disabled prop is true", () => {});
});
```

### Git Hooks Already in Place

```json
"simple-git-hooks": {
  "pre-commit": "pnpm nano-staged && node packages/cli/scripts/sync-templates.js --pre-commit",
  "pre-push": "node scripts/pre-push.mjs"
}
```

Pre-commit: Biome format + check via `nano-staged`, then template sync.
Pre-push: changeset presence check, then `pnpm test`.

Tests run at push, not at commit.

---

## Code Quality

### Linting & Formatting

This monorepo uses [Biome](https://biomejs.dev/) (`^2.5.14`) for both linting and formatting. There is no ESLint and no Prettier.

```bash
# Format + auto-fix (this is what pnpm lint does)
pnpm lint

# Lint every workspace
pnpm lint:all

# Format only
pnpm format

# Repo convention checks, run separately in CI
pnpm standards
```

Root scripts, verbatim:

| Script | Command |
|--------|---------|
| `lint` | `biome format --write && biome check --write` |
| `lint:unsafe` | Biome check with unsafe fixes applied |
| `lint:all` | `turbo run lint` |
| `format` | `biome format --write` |
| `standards` | `node scripts/check-standards.mjs` |

`pnpm lint` writes. CI runs it on a clean checkout, so an unformatted tree fails.

### Biome Configuration

`biome.json` at the root applies to all packages. No package overrides it.

### No Authored TypeScript

The repo is ESM-only and JavaScript-only: **`.js` and `.jsx` files, no authored `.ts` or `.tsx`, no type annotations, no `tsconfig` for web or packages.** See [ADR-002](./adr/002-no-typescript.md).

The single exception is `apps/mobile/`, an Expo / React Native target that must use `.ts` / `.tsx` to work with its ecosystem. The CI `mobile` job runs `npx tsc --noEmit` there. Nothing else in the repo is type-checked.

Two files legitimately contain `.ts` without being authored TypeScript: the Prisma-generated client under `packages/db/src/generated/prisma/`, and the CLI's mobile template.

Zod is the type-safety mechanism at every system boundary. All Server Actions and API routes validate with Zod.

### JSDoc for Type Information

Since there is no compiler, JSDoc is how editors and agents learn a function's contract:

```javascript
/**
 * @typedef {{ variant?: "primary" | "secondary", children: import("react").ReactNode }} ButtonProps
 */

/**
 * @param {ButtonProps} props
 * @returns {import("react").ReactElement}
 */
export function Button({ variant = "primary", children }) {
  // ...
}
```

There is no `jsconfig.json` with `checkJs` in this repo. JSDoc is documentation and editor hinting here, not an enforced typecheck.

### Avoid Untyped Code

```javascript
// Bad: no type information
function process(data) {}

// Good: JSDoc documents the contract
/**
 * @param {unknown} data
 * @returns {Promise<Array<{ id: string }>>}
 */
async function process(data) {
  if (isValidData(data)) {
    // Editor and reader both know the shape now
  }
}
```

### Code Review Checklist

- [ ] Tests added or updated for the change
- [ ] JSDoc on new public functions
- [ ] No `console.*` in app/runtime code: use `createLogger()` from `@usequark/quark-core`
- [ ] No `throw new Error` in app/runtime code: use `AppError` / `ValidationError` from `@usequark/quark-core/errors`
- [ ] Zod validation on every Server Action and API route input
- [ ] Templates synced if `apps/`, `packages/db|config|ui|jobs` changed
- [ ] Changeset added if a published package changed
- [ ] Documentation updated if needed
- [ ] No hardcoded values: read from config
- [ ] Follows existing code patterns

---

## Documentation

### Code Documentation

#### JSDoc Comments

Document public APIs. Match the existing convention of describing the data, the throws, and giving a runnable example:

```javascript
/**
 * Creates a new user in the database.
 *
 * @param {{ email: string, name: string, password: string }} data - The user data to create
 * @returns {Promise<import("./generated/prisma/client.ts").User>} The created user object
 * @throws {import("@usequark/quark-core/errors").ConflictError} If the email already exists
 *
 * @example
 * const created = await user.create({
 *   email: "john@example.com",
 *   name: "John Doe",
 * });
 */
export async function create(data) {
  return prisma.user.create({ data });
}
```

The `User` type comes from the generated client, not from `@prisma/client`. See [Import Guidelines](#import-guidelines).

### README Requirements

Each package should have a README with:

1. **Purpose**: what the package does
2. **Installation**: how to add it to a project
3. **Usage**: basic examples
4. **API reference**: exported functions and components
5. **Contributing**: how to contribute

### Keeping Docs Updated

- Update docs in the same PR as the code change
- Use `docs/adr/` for architecture decisions, not free-form notes
- Prefer removing a stale claim over qualifying it. A hedged statement about something that does not exist is still wrong.

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview, getting started |
| `AGENTS.md` | Agent and contributor coding conventions |
| `CONTRIBUTING.md` | Contribution guidelines |
| `SECURITY.md` | Security policy |
| `CODE_OF_CONDUCT.md` | Code of conduct |
| `docs/API.md` | API reference documentation |
| `docs/ARCHITECTURE.md` | System architecture |
| `docs/DATABASE.md` | Prisma schema, migrations, connection |
| `docs/DESIGN_NOTES.md` | Design direction |
| `docs/MAINTAINABILITY.md` | This document |
| `docs/TESTING_INFRASTRUCTURE.md` | Testing approach and counts |
| `docs/QUARK_USAGE.md` | End-to-end usage guide |
| `docs/adr/` | Architecture decision records (001 through 005) |
| `docs/archive/reference/` | Archived verticals, kept for reference only |
| `CHANGELOG.md` | Version history, per published package |

There is no `CONTRIBUTORS.md`. The contribution guide is `CONTRIBUTING.md`.

---

## Version Control

### Branch Strategy

```
main                    # Production-ready code
├── feature/ABC-123     # Feature branches
├── fix/ABC-456         # Bug fix branches
└── chore/upgrade-next-16
```

### Release Process

Quark uses [Changesets](https://github.com/changesets/changesets). The sequence matters:

1. Make changes on a branch
2. Run `pnpm changeset` (interactive) to create `.changeset/*.md`
3. Commit code + changeset, open a PR
4. CI runs lint, standards, tests, build, and a changeset check
5. Merge to `main`
6. The release workflow opens a **"chore: version packages"** PR
7. **Merge that PR with a merge commit, never a squash**

That last point is load-bearing. Changesets decides whether to publish by checking whether the commit came from the `changeset-release/main` branch. A squash merge rewrites the message to `chore: version packages (#123)`, which drops the branch name, so the action concludes no release was merged and merely regenerates the PR. Versions get bumped in `package.json` and `CHANGELOG.md`, CI stays green, and npm keeps serving the old version. This happened for several releases before it was caught. `scripts/check-release-published.mjs` now fails CI if a squash-merged release commit reaches `main` without publishing.

**Never** run `pnpm changeset version` locally. CI owns that step. Never `git tag` manually.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation changes
- `style`: formatting, no code change
- `refactor`: code refactoring
- `test`: adding or updating tests
- `chore`: maintenance tasks

**Examples:**
```bash
feat(ui): add Input component with validation support
fix(db): handle null email in user queries
docs(api): update authentication endpoints
refactor(jobs): extract queue configuration to separate file
test(ui): add Button accessibility tests
chore(deps): update prisma to 7.10.0
```

### Pull Request Guidelines

1. **Title**: conventional commit format
2. **Description**: include context, screenshots if UI change
3. **Size**: keep PRs focused
4. **Reviews**: at least one approval
5. **CI**: `checks`, `test`, `mobile`, and `build` jobs must all pass

---

## Monitoring & Observability

### Logging Standards

Use `createLogger` from `@usequark/quark-core`. Console output is reserved for bootstrap, CLI, and test code.

```javascript
import { createLogger } from "@usequark/quark-core";

const logger = createLogger({ name: "users" });

// Good: structured with context
logger.info("User created", {
  userId: user.id,
  email: user.email,
});

logger.error("Failed to process job", {
  jobId: job.id,
  error: error.message,
});
```

Pass an options object with `name`. The bare-string form `createLogger("users")` is also used in the repo, but it falls through to the default name `app`, so the object form is what you want.

In production (`NODE_ENV=production`) entries serialize as single-line JSON. In development they render as colorized text. The minimum level comes from `LOG_LEVEL`, defaulting to `debug` in development and `info` in production.

`createLogger()` returns `debug`, `info`, `warn`, `error`, `fatal`, and `child(context)`. Create one module-level logger and pass it around; do not create one per call.

Bad: string-concatenated output straight to the console, with no level and no structured fields.

### Error Handling

Throw `AppError` or one of its subclasses. Never throw a bare `Error` in app or runtime code.

```javascript
import { AppError, NotFoundError } from "@usequark/quark-core/errors";
import { createLogger } from "@usequark/quark-core";

const logger = createLogger({ name: "users" });

// Core error classes, all extending AppError:
// AppError, ValidationError, UnauthorizedError, ForbiddenError,
// NotFoundError, ConflictError, RateLimitError, DatabaseError, ServiceError

export async function findById(id) {
  const found = await prisma.user.findUnique({ where: { id } });
  if (!found) {
    throw new NotFoundError(`User not found: ${id}`);
  }
  return found;
}

// Handle consistently at the boundary
try {
  const found = await findById(id);
} catch (error) {
  if (error instanceof NotFoundError) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  logger.error("Unexpected error", { error: error.message });
  throw new AppError("Internal server error", 500, "INTERNAL_ERROR");
}
```

`packages/core` also exports helpers: `getErrorMessage(error)`, `getStatusCode(error)`, `normalizeError(error)`, `logError(error, context)`, and `withErrorHandling(fn)`.

Server Actions validate with Zod first, then throw:

```javascript
"use server";
import { z } from "zod";
import { ValidationError } from "@usequark/quark-core/errors";
import { prisma } from "<scope>/db";

const schema = z.object({ email: z.string().email(), name: z.string().min(1) });

export async function createUser(formData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());
  return prisma.user.create({ data: parsed.data });
}
```

### Health Checks

Probing logic lives in `@usequark/quark-core/health`. It exports `runHealthChecks`, `createDefaultProbes`, `checkStorage`, `checkQueues`, `isFailing`, `logHealthReport`, plus `DEFAULT_PROBE_TIMEOUT` (3000 ms) and `DEFAULT_HEALTH_TIMEOUT` (5000 ms). Each probe runs concurrently under its own deadline.

`apps/web/src/app/api/health/route.js` is the thin HTTP shell around it:

```javascript
import {
  checkQueues,
  checkStorage,
  createLogger,
  getRegisteredQueues,
  pingRedis,
  runHealthChecks,
} from "@usequark/quark-core";
import { pingDatabase } from "<scope>/db";
import { NextResponse } from "next/server";

const logger = createLogger({ name: "health" });

export async function GET() {
  try {
    const result = await runHealthChecks({
      probes: {
        database: pingDatabase,
        redis: pingRedis,
        storage: checkStorage,
        queues: () => checkQueues(getRegisteredQueues),
      },
    });

    // Always 200. The verdict lives in the body's `status` field.
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logger.error("Health check failed", {
      error: error.message,
      stack: error.stack,
    });
    // ...
  }
}
```

`pingDatabase` is injected rather than imported by core, because the db package depends on core and a reverse import would create a cycle.

**Do not return a non-200 from this route.** It is the platform healthcheck. A non-200 makes the orchestrator restart the container, dropping every warm connection and producing a connection storm on the dependency that was already struggling. Callers needing a hard verdict read `status` from the body.

---

## Refactoring Guidelines

### When to Refactor

- **Rule of Three**: if you are copying code a third time, extract it
- **Complexity**: when cyclomatic complexity gets hard to follow by reading
- **Readability**: when code requires comments to understand
- **Performance**: when profiling identifies bottlenecks

### Safe Refactoring Process

1. **Establish test coverage first**, at whatever level is achievable. Coverage is not enforced, which means this step is on you
2. **Make small, incremental changes**
3. **Run tests after each change**
4. **Commit frequently** with clear messages
5. **Get code review** for significant changes
6. **Re-sync templates** if you touched a source directory

### Common Refactoring Patterns

| Pattern | When to Apply |
|---------|--------------|
| Extract Function | Long functions |
| Extract Component | Repeated UI patterns |
| Extract Hook | Shared React state logic |
| Add Query Helper | Repeated Prisma access patterns in `packages/db/src/queries.js` |
| Rename | Unclear naming |
| Move | Wrong location in structure |

### Example: Extracting Shared Logic

```javascript
// Before: duplicated in multiple files
async function getUserJobs(userId) {
  return prisma.job.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

// After: centralized in <scope>/db, packages/db/src/queries.js
export const job = {
  /** @param {string} userId */
  findByUser: (userId) =>
    prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
};
```

`Job` is one of the seven core models, so this example maps to something real. `packages/db/src/queries.js` exports helpers for exactly: `user`, `job`, `account`, `session`, `verificationToken`, `auditLog`, `file`. There is no `post` helper and no `Post` model. Add domain helpers yourself as your schema grows.

---

## Technical Debt Management

### Tracking Technical Debt

Use `TODO`, `FIXME`, and `HACK` comments with ticket references:

```javascript
// TODO(ABC-123): Add pagination support
// FIXME(ABC-456): Race condition in concurrent updates
// HACK(ABC-789): Workaround for library bug, remove after v2.0
```

`pnpm standards` runs `scripts/check-standards.mjs`, which has its own test suite at `scripts/check-standards.test.mjs` and runs in CI.

### Technical Debt Register

Maintain a list of known technical debt:

| ID | Description | Impact | Effort | Priority |
|----|-------------|--------|--------|----------|
| TD-001 | No pagination helper in the db query layer | High, performance | Medium | High |
| TD-002 | Hardcoded config values in places that should read config | Medium, flexibility | Low | Medium |
| TD-003 | `apps/web` Server Action paths lack tests | Medium, correctness | Medium | Medium |
| TD-004 | No coverage signal anywhere | Medium, confidence | Low | Medium |

TD-001 through TD-003 mirror the gaps recorded in [TESTING_INFRASTRUCTURE.md](./TESTING_INFRASTRUCTURE.md#current-gaps). Keep the two documents consistent when one changes.

### Addressing Technical Debt

- **Sprint allocation**: reserve capacity per sprint
- **Boy Scout Rule**: leave code cleaner than you found it
- **Debt sprints**: periodic sprints focused on debt reduction

---

## Upgrade Strategy

### Framework Upgrades

#### Before Upgrading

1. Read the changelog and migration guide
2. Check for breaking changes
3. Verify all dependencies are compatible
4. Create a branch for the upgrade

#### Upgrade Process

```bash
# 1. Create upgrade branch
git checkout -b chore/upgrade-next-16

# 2. Update package versions
pnpm update next@latest --filter @usequark/quark-web

# 3. Run tests
pnpm test

# 4. Fix any issues
# ...

# 5. Build all packages
pnpm build

# 6. Manual testing in development
pnpm dev

# 7. Sync templates if you touched a source directory
pnpm --filter @usequark/quark-create-app sync-templates
```

### Database Migrations

```bash
# 1. Make schema changes
# Edit packages/db/prisma/schema.prisma

# 2. Generate the client (output: packages/db/src/generated/prisma)
pnpm db:generate

# 3. Create and apply a migration
pnpm db:migrate

# 4. For deployment, apply checked-in migrations instead
pnpm db:migrate:deploy
```

Other db scripts: `db:push` (schema sync without a migration) and `db:seed`.

Base schema is seven models: `User`, `Account`, `Session`, `VerificationToken`, `Job`, `File`, `AuditLog`. Add domain models through the `add-model` skill. There is no schema trimming step and no `--full-schema` flag.

Every model carries `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.

### Deprecation Process

When deprecating code:

1. **Mark it as deprecated** in JSDoc
2. **Log a warning** through the logger, not the console
3. **Document it** in the changelog via a changeset
4. **Remove it** after a grace period

```javascript
import { createLogger } from "@usequark/quark-core";

const logger = createLogger({ name: "users" });

/**
 * @deprecated Use `user.findById()` instead. Will be removed in the next major.
 * @param {string} id
 */
export function getUserById(id) {
  logger.warn("getUserById is deprecated, use user.findById instead", { id });
  return user.findById(id);
}
```

---

## Monorepo-Specific Guidelines

### Adding New Packages

1. Create the directory:
   ```bash
   mkdir -p packages/new-package/src
   ```

2. Create `package.json`:
   ```json
   {
     "name": "@usequark/quark-new-package",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "main": "./src/index.js",
     "exports": {
       ".": "./src/index.js"
     },
     "scripts": {
       "test": "node --test $(find src -name '*.test.js')",
       "lint": "biome check --write ."
     }
   }
   ```

   Set `private: true` unless the package is meant to be published. Only two packages are published; adding a third is a deliberate decision, not a default.

3. Add tests and a README
4. Install dependencies and update the lockfile:
   ```bash
   pnpm install
   ```

### Removing Packages

1. Remove from dependent packages first
2. Update all imports
3. Run tests to verify
4. Delete the package directory
5. Run `pnpm install` to update the lockfile
6. Re-sync templates if a scaffolded package was involved

### Cross-Package Changes

When making changes that affect multiple packages:

1. Plan the order of changes
2. Update shared packages first
3. Then update dependent packages
4. Test the entire dependency chain
5. Run `sync-templates` last, and commit the generated output

---

## Performance Considerations

### Build Performance

```bash
# Build everything (turbo caches per task)
pnpm build

# Inspect what turbo would do
turbo run build --dry-run
```

`turbo run test` depends on `^build` and `db:generate`, so the Prisma client is generated before database-backed suites run.

### Runtime Performance

- Use React Server Components where possible
- Implement proper data fetching patterns
- Optimize database queries with indexes
- Use connection pooling. `packages/db` builds the `pg` pool from `DB_POOL_MAX` (default 10 in production, 5 in development), `DB_POOL_IDLE_TIMEOUT` (30 000 ms), and `DB_POOL_CONNECTION_TIMEOUT` (5 000 ms).

### Bundle Size

```bash
# Inspect what Next would emit, per route, with bundle sizes
pnpm --filter @usequark/quark-web build

# Check for duplicate dependencies
pnpm dedupe
```

There is no `analyze` script in `apps/web` and no bundle analyzer wired in. The `next build` output is the available signal.

---

## Quick Reference

### Common Commands

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Run development | `pnpm dev` |
| Run tests | `pnpm test` |
| Run integration tests | `pnpm test:integration` |
| Lint and format | `pnpm lint` |
| Lint all workspaces | `pnpm lint:all` |
| Repo convention checks | `pnpm standards` |
| Build all | `pnpm build` |
| Generate Prisma client | `pnpm db:generate` |
| Create a migration | `pnpm db:migrate` |
| Sync CLI templates | `pnpm --filter @usequark/quark-create-app sync-templates` |
| Check template drift | `pnpm --filter @usequark/quark-create-app sync-templates:check` |
| Create a changeset | `pnpm changeset` |
| Start local services | `pnpm docker:up` |
| Stop local services | `pnpm docker:down` |

### All Root Scripts

`clean`, `clean:check`, `clean:deep`, `build`, `dev`, `dev:sync`, `dev:mobile`, `build:mobile`, `lint`, `lint:unsafe`, `lint:all`, `standards`, `smoke:published`, `test`, `test:integration`, `docker:up`, `docker:down`, `docker:logs`, `docker:list`, `docker:restart`, `docker:clean`, `db:generate`, `db:migrate`, `db:migrate:deploy`, `db:push`, `db:seed`, `format`, `new`, `changeset`, `version-packages`, `release`, `prepare`.

### Key Files

| File | Purpose |
|------|---------|
| `turbo.json` | Turborepo task configuration and caching |
| `pnpm-workspace.yaml` | Workspace package definition |
| `biome.json` | Linting and formatting rules |
| `pnpm-lock.yaml` | Lockfile |
| `AGENTS.md` | Coding conventions and non-negotiable rules |

---

## Further Reading

- [TESTING_INFRASTRUCTURE.md](./TESTING_INFRASTRUCTURE.md), measured counts, CI pipeline, test utilities
- [QUARK_USAGE.md](./QUARK_USAGE.md), end-to-end usage for scaffolded projects
- [AGENTS.md](../AGENTS.md), coding conventions
- [CONTRIBUTING.md](../CONTRIBUTING.md), contribution guidelines
- [Architecture Decision Records](./adr/README.md)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Biome Documentation](https://biomejs.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Node.js Test Runner](https://nodejs.org/api/test.html)

---

*Last verified: October 7, 2026*