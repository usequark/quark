# @techstream/quark-create-app

## 1.13.1

### Patch Changes

- [`5a360a9`](https://github.com/Bobnoddle/quark/commit/5a360a979d1a021969680386b4f9adfbc3335308) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix admin scaffolding so Quark create and add also include the CMS package and routes, rewrite generated workspace package names consistently, and keep optional package dependencies installable in generated apps.

## 1.13.0

### Minor Changes

- [`cd830d9`](https://github.com/Bobnoddle/quark/commit/cd830d95a3ef66d37b2a0f28d21c910a75d84d1e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add CMS scaffolding, media management flows, security contact metadata, and release-tooling improvements to the Quark CLI templates.

  This release also hardens template sync by excluding local uploads from generated scaffolds.

## 1.11.0

### Minor Changes

- [`b07c53a`](https://github.com/Bobnoddle/quark/commit/b07c53af1ef756e0dfb89a03ee011f7a91406438) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - **CLI:** Add `--admin-routes` scaffold flag that generates a full admin panel — CRUD route handlers, field renderer, model table/form components, sidebar, sign-out button, and a dashboard data helper. Admin template now ships with `field-map`, `introspect`, and `query` utilities.

  **CLI:** Update `ui` template with `ErrorBanner`, `RichText`, and updated `ThemeProvider`/theme toggle components. Update `base-project` template with registration, forgot-password, and sign-out auth pages, a floating theme toggle, and revised seed/query helpers. Update `worker` template with default email and file job handlers.

  **Core:** Pre-register queue metrics as named exports from `@techstream/quark-core`: `jobQueueDepth` (gauge), `jobsProcessedTotal` (counter), and `jobDuration` (histogram). Wire `completed` and `failed` worker event handlers to record these metrics automatically. Add `getRegisteredQueues()` and `updateQueueDepths()` helpers so workers can periodically refresh the queue-depth gauge.

## 1.10.0

### Minor Changes

- [`9c7ea5f`](https://github.com/Bobnoddle/quark/commit/9c7ea5fbf92037fca1a3193de27e2139d8edba30) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## @techstream/quark-create-app

  ### UI Component Library — scaffolded projects now include a full component set

  New projects scaffolded with `create-quark-app` now include a complete `ui` package with all core primitives and their tests:

  - `Textarea`, `Badge`, `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`
  - `Checkbox`, `Dialog` (client), `Input`, `Label`, `Select`, `Skeleton`
  - `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`
  - `Toast`/`useToast` (client)
  - Theme constants and theme utilities

  ### Worker — email and file job handlers included by default

  The scaffolded `worker` package now ships with ready-to-use job handlers:

  - `handlers/email.js` — handles `sendEmail` jobs via the core email service
  - `handlers/files.js` — handles `processFile` jobs
  - `handlers/index.js` — handler registry
  - Full test coverage for all handlers

  ### AI tool conventions baked into scaffolded projects

  New projects include pre-configured AI tool integration files: `CLAUDE.md`, `.cursor/rules/quark.mdc`, `SKILL.md`, and `copilot-instructions.md` with Quark-specific conventions matching the monorepo standards.

  ***

  ## @techstream/quark-core

  ### Fixes

  - `throttledError` in Redis utilities now logs as **warnings** instead of errors to reduce noise for expected transient failures
  - `waitForRedis` error messages improved for clarity
  - Export ordering in `mail.js` corrected

  ### Refactors

  - Redis error handling streamlined (`redis.js`, `queue/index.js`) — no breaking API changes

## 1.9.0

### Minor Changes

- [`fb110e7`](https://github.com/Bobnoddle/quark/commit/fb110e755664ac70ccea7d768a35bd87f72c1492) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## @techstream/quark-core

  ### Email — pluggable provider system

  The email service has been refactored to use a **Strategy Pattern**. A new `EmailProvider` base class is now exported, along with a `registerEmailProvider()` function so applications can plug in any email provider.

  Built-in providers:

  - `smtp` — Nodemailer (unchanged behaviour)
  - `resend` — Resend API (unchanged behaviour)
  - `zeptomail` — **new** ZeptoMail provider (set `EMAIL_PROVIDER=zeptomail` + `ZEPTOMAIL_TOKEN`)

  Custom providers can be registered at startup and used transparently:

  ```js
  import { EmailProvider, registerEmailProvider } from "@techstream/quark-core";

  class SendGridProvider extends EmailProvider {
    async sendEmail(to, subject, html, text) { … }
  }
  registerEmailProvider("sendgrid", SendGridProvider);
  ```

  ### Storage — pre-signed S3 upload URLs

  `createS3Storage()` now exposes `getSignedUploadUrl(key, options?)` which generates a pre-signed `PUT` URL for direct client-to-S3/R2 uploads (no server proxy required). The local storage adapter exposes the same method and throws a helpful error pointing developers to the correct upload route.

  ```js
  const { url, key, expiresAt } = await storage.getSignedUploadUrl(
    "uploads/photo.jpg",
    {
      expiresIn: 300, // seconds (default: 300)
      contentType: "image/jpeg",
    }
  );
  ```

  ## @techstream/quark-create-app

  ### New utility — `formatProjectDisplayName()`

  A new `formatProjectDisplayName(name)` utility converts a kebab-case project slug to a human-readable title (e.g. `my-cool-app` → `My Cool App`). It is used internally during scaffolding and is exported for use in scripts.

  ### Scaffolded project improvements

  - **`.env.example`** — improved structure and comments: copy-paste instructions at the top, ZeptoMail config block, database pool notes, and `WORKER_CONCURRENCY` variable documented.
  - **`validate-env.js`** — new optional env vars recognised: `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_URL`, `ZEPTOMAIL_BOUNCE_EMAIL`, `APP_DESCRIPTION`, `WORKER_CONCURRENCY`.
  - **Health check** (`/api/health`) — now verifies storage connectivity in addition to database and Redis.
  - **Admin package scaffolding** — `pnpm create quark-app` now includes the admin UI package scaffold.
  - **`nano-staged` / `simple-git-hooks`** — updated linting hooks in the scaffolded template.

## 1.8.0

### Minor Changes

- [`68c1aa1`](https://github.com/Bobnoddle/quark/commit/68c1aa12253d66779620b18654a8dc8b6baa8d81) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add flexible CLI options and comprehensive test coverage for project scaffolding:

  - **New CLI Flags:**

    - `--no-prompts` — Non-interactive project creation for CI/CD and automation
    - `--features <list>` — Selective package scaffolding (default: `ui,jobs`; valid: `ui`, `jobs`)
    - `--skip-install` — Skip `pnpm install` step during scaffolding for faster iterations
    - `--skip-docker` — Skip Docker volume cleanup for development workflows

  - **New Testing Infrastructure:**

    - Full lifecycle E2E test (`test:e2e:full`) covering 7 phases: project creation → Docker startup → database migration → HTTP health check (~30-41s)
    - Flag validation unit tests (`test:flags`) with 9 automated test cases (100% pass rate)
    - GitHub Actions workflow (`cli-e2e-full.yml`) for automated testing on CLI changes

  - **Improvements:**

    - HTTP health check timeout increased from 10s to 30s for reliability in slow environments
    - Parallel Docker service startup with `--wait` flag support
    - Removed unused internal variables and corrected log output typos

  - **Database Seeding:**

    - Added `prisma/seed.js` with test user and sample data generation
    - Seeding support in both monorepo and scaffolded templates
    - Enhanced CLI to manage database initialization seamlessly

  - **Performance Monitoring:**
    - New `check:perf` script with structured JSON output
    - Threshold-based performance checks for E2E workflows

## [Unreleased]

### Added

- `--no-prompts` flag for non-interactive project creation (CI/CD and automation use)
- `--features <list>` flag to specify optional packages to scaffold (default: `ui,jobs`; valid values: `ui`, `jobs`)
- `--skip-install` flag to skip `pnpm install` step during scaffolding
- `--skip-docker` flag to skip Docker volume cleanup step
- Full lifecycle E2E test (`test:e2e:full`) covering 7 phases: project creation → Docker startup → database migration → HTTP health check (~30-41s)
- Flag validation unit tests (`test:flags`) with 9 automated test cases (100% pass rate)
- GitHub Actions workflow (`cli-e2e-full.yml`) for full lifecycle testing on CLI changes
- Performance monitoring script (`check:perf`) with structured JSON output and threshold checks

### Improved

- HTTP health check timeout increased from 10s to 30s for better reliability in slow environments
- Docker service readiness now runs in parallel with `--wait` flag support, reducing startup time

### Fixed

- Removed unused internal variables (`_TEST_TIMEOUT`, `_currentPhase`, `_isPortInUse`)
- Log output typo corrected (`"porta"` → `"port"`)

## 1.7.0

### Minor Changes

- [`e41d79e`](https://github.com/Bobnoddle/quark/commit/e41d79e8a44b2a4d1a0799ca1fecc282b58b4524) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Refactor database connection string logic and enhance environment validation:

  - **feat:** Add Railway deployment configuration for web and worker services with health checks and restart policies
  - **feat:** Enhance environment validation with service-scoped checks (web/worker) and cross-field validation
  - **feat:** Add APP_NAME configuration variable for metadata, emails, and page titles
  - **feat:** Centralize PostgreSQL connection string builder in shared module (`connection.js`)
  - **refactor:** Simplify database client and Prisma config to use shared connection builder
  - **refactor:** Update mail configuration for local development (Mailpit) with cleaner env var handling
  - **test:** Add comprehensive unit tests for PostgreSQL connection string builder covering all scenarios
  - # **chore:** Update Biome schema to 2.4.2

## [Unreleased]

### Added

- `--no-prompts` flag for non-interactive project creation (CI/CD and automation use)
- `--features <list>` flag to specify optional packages to scaffold (default: `ui,jobs`; valid values: `ui`, `jobs`)
- `--skip-install` flag to skip `pnpm install` step during scaffolding
- `--skip-docker` flag to skip Docker volume cleanup step
- Full lifecycle E2E test (`test:e2e:full`) covering 7 phases: project creation → Docker startup → database migration → HTTP health check (~30-41s)
- Flag validation unit tests (`test:flags`) with 9 automated test cases (100% pass rate)
- GitHub Actions CI workflow (`cli-test.yml`) for PR validation
- GitHub Actions nightly workflow (`cli-e2e-full.yml`) for full lifecycle testing

### Improved

- HTTP health check timeout increased from 10s to 30s for better reliability in slow environments
- Docker service readiness now runs in parallel with `--wait` flag support, reducing startup time

### Fixed

- Removed unused internal variables (`_TEST_TIMEOUT`, `_currentPhase`, `_isPortInUse`)
- Log output typo corrected (`"porta"` → `"port"`)

## 1.6.0

### Minor Changes

- [`1fd64b1`](https://github.com/Bobnoddle/quark/commit/1fd64b14d9bce32ca8f3246127e1134d0fb1a3aa) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## Production-Readiness Update

  ### @techstream/quark-create-app (minor)

  Enhanced template synchronization and CLI initialization with improved production-readiness features:

  - **New sync-templates.js script**: Robust template synchronization with proper configuration merging and file handling
  - **Updated CLI initialization**: Improved biome configuration handling and template scaffold generation
  - **Template enhancements**:
    - Added GitHub workflows for CI, auto-merge, and release management
    - Improved environment configuration with production SMTP settings
    - Enhanced seed script with user seeding functionality and audit log handling
    - Added validation for email provider and storage options
    - Support for Resend and S3 storage providers in config templates

  ### @techstream/quark-core (patch)

  - **Code refactoring**: Reorganized testing factories module for improved maintainability
  - **No API changes**: All exports and functionality remain stable

  ## Related Issues

  Completes all phases of the production-readiness review plan:

  - Phase 1: Critical Security (10 items) ✅
  - Phase 2: High Severity (6 items) ✅
  - Phase 3: Medium Severity (8 items) ✅
  - Phase 4: Low Severity/Polish (5 items) ✅

  ## Breaking Changes

  **Note**: The core database package has breaking changes (Post model removed), but since `@<app>/db` is scaffolded locally (not published to npm), no version bump is required. The removal is reflected in template updates provided by the updated CLI.

## 1.5.3

### Patch Changes

- [`5069069`](https://github.com/Bobnoddle/quark/commit/50690698d4fe1daeaa7f5b49bfb20a97074a2744) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add query builder utilities with search/sort support and introduce request/response logging middleware. Improve CLI docs and add optional build verification test, plus checklist updates.

- [`f142e9c`](https://github.com/Bobnoddle/quark/commit/f142e9c57dcac93bfe90bae757ed4126f989a888) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix: complete file upload template, fix migration drift, and clean up orphaned Docker volumes

  - **Docker volume cleanup:** Automatically remove orphaned Docker volumes from previous projects with the same name, preventing `P1000: Authentication failed` errors when re-scaffolding
  - Add missing `File` model to template `schema.prisma` with `User` relation
  - Add `file` query builder to template `queries.js` (create, findById, findByUploader, findOrphaned, delete, etc.)
  - Add `fileUploadSchema` Zod schema to template `schemas.js`
  - Add `File` table, indexes, and foreign key to template initial migration SQL
  - Fix migration SQL drift: add `Account.createdAt`/`updatedAt` columns, `Session.expires` index, `VerificationToken.expires` index, and `Job(status, runAt)` compound index
  - Register `quark-update` as a bin alias so `npx quark-update` works
  - Fix post-scaffolding output to show `npx @techstream/quark-create-app update`

## 1.5.2

### Patch Changes

- [`399e7da`](https://github.com/Bobnoddle/quark/commit/399e7da083f26cb1d0196a467e78500129eba4ce) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix: update CLI output and add `quark-update` bin alias

  - Register `quark-update` as a bin alias so `npx quark-update` works
  - Fix post-scaffolding output to show `npx @techstream/quark-create-app update`

## 1.5.1

### Patch Changes

- [`39a99c2`](https://github.com/Bobnoddle/quark/commit/39a99c2c2723cc533126531ced2d610ea10353a8) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - chore: normalize package scopes to @techstream in CLI templates

  - Rename `@quark/web` → `@techstream/quark-web` in scaffolded projects
  - Rename `@quark/worker` → `@techstream/quark-worker` in scaffolded projects
  - Normalize template versions to 1.0.0

## 1.5.0

### Minor Changes

- [`590592d`](https://github.com/Bobnoddle/quark/commit/590592d87c8dc796fc8025643997b0b0d31cceef) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: add file upload, validation, and storage system

  - Add file validation module with MIME type checking, size limits, and malicious content detection
  - Add multipart form data parsing utilities
  - Add pluggable storage adapters (local filesystem and S3-compatible)
  - Add File model to Prisma schema with associated queries and Zod schemas
  - Add file processing job definition
  - Add file upload/download API routes to the web app
  - Add email and file processing handlers to the worker
  - Update CLI templates to include file upload infrastructure

## 1.4.0

### Minor Changes

- [`17656c6`](https://github.com/Bobnoddle/quark/commit/17656c684cd826d8026573b44ae271c197a9110b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add automated release pipeline with Changesets
