# @techstream/quark-create-app

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
  - **chore:** Update Biome schema to 2.4.2
=======
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
