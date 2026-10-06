# @usequark/quark-core

## 2.5.7

### Patch Changes

- [#219](https://github.com/usequark/quark/pull/219) [`265e7fd`](https://github.com/usequark/quark/commit/265e7fd16dda9a0f2ccbe344db4aba7e8cad4eab) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Stop `pingRedis` from putting a Redis password in a message that is served
  publicly.
  
  On a connection failure, `pingRedis` returned
  `Redis unreachable at ${getRedisUrl()}` — and `getRedisUrl()` returns `REDIS_URL`
  verbatim, credentials included. The scaffolded `/api/health` route copies that
  message straight into its JSON response, and the route has no auth. With
  `REDIS_URL=redis://default:hunter2@cache.internal:6379`, an unauthenticated
  `GET /api/health` returned the Redis password.
  
  `pingDatabase` already disclosed only `hostname:port`. `pingRedis` now matches
  it, via a new `getRedisEndpoint()` that returns `host:port` with every
  credential removed — `cache.internal:6379`, defaulting the port to 6379 (6380 for
  `rediss://`), and falling back to a redacted form if `REDIS_URL` cannot be
  parsed. `getRedisUrl()` is unchanged and still returns the working connection
  string for callers that need to connect.
  
  Also adds `redactUrl(value)` to the core barrel: strips the username and
  password from any URL, for callers that need to embed one in a message.

## 2.5.6

### Patch Changes

- [#199](https://github.com/usequark/quark/pull/199) [`c42f6c6`](https://github.com/usequark/quark/commit/c42f6c611c7389c8a755e8ae3d66d2dd370b3bbf) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Trim the published CLI tarball and add npm search keywords to both packages.
  
  **Test files are no longer published.** `files` now negates `src/**/*.test.js`,
  which drops 12 files (~72 KB) from the tarball — 237 files down to 225. Nothing
  imported them: the only reference to a test file anywhere in shipped source is a
  comment, and `test-cli.js` that runs them was already excluded because it sits
  outside `files`. Nothing shipped is lost.
  
  Verified by packing both variants and diffing the resulting tarballs: exactly the
  12 test files are removed and nothing else. `deploy.integration.test.js` is
  covered by the same glob, so one pattern is enough. The templates are untouched —
  they contain no test files, so the negation cannot affect a scaffolded project's
  own tests. CI runs the E2E suite from the repository rather than from a packed
  tarball, so it is unaffected.
  
  The packed tarball was installed into a clean directory and smoke-tested: the
  `quark` binary resolves and reports its version.
  
  **`keywords` added.** npm's `scope:` search qualifier returns nothing even for
  packages published eight months ago, so it is not a usable discovery path, and a
  search for the scoped name surfaces unrelated higher-population packages first.
  Keywords are the field npm actually weighs, and neither package declared any:
  
  - `@usequark/quark-core` — quark, nextjs, auth, bullmq, redis, email, storage,
    rate-limiting, logging, zod
  - `@usequark/quark-create-app` — quark, scaffolding, scaffolder, cli, nextjs,
    prisma, bullmq, railway, self-hosted
  
  Neither change affects runtime behaviour or any exported API.

## 2.5.5

### Patch Changes

- [#196](https://github.com/usequark/quark/pull/196) [`19e6a23`](https://github.com/usequark/quark/commit/19e6a2365ecc9828faff379c0d171bce13a88933) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Move the published npm packages from the `@techstream` scope to `@usequark`,
  matching the GitHub organisation the project now lives under.
  
  - `@techstream/quark-core` -> `@usequark/quark-core`
  - `@techstream/quark-create-app` -> `@usequark/quark-create-app`
  
  **No runtime or API change.** `quark-core` keeps all 17 `exports` subpaths
  resolving to byte-identical files, and the CLI keeps the same four `bin` names
  (`quark`, `quark-create-app`, `create-quark-app`, `quark-update`), so only the
  install specifier changes:
  
  ```bash
  npm install @usequark/quark-core
  npx @usequark/quark-create-app
  ```
  
  Scaffolded projects are unaffected in shape — the local-only workspace packages
  (`db`, `jobs`, `ui`, `config`) are still rewritten to your own scope — but the
  published `quark-core` dependency a new project receives is now
  `@usequark/quark-core`.
  
  The `@techstream` packages remain installable and are not being unpublished. If
  you are still on them, switch when convenient:
  
  ```bash
  npm install @usequark/quark-core@latest
  ```

## 2.5.4

### Patch Changes

- [#190](https://github.com/usequark/quark/pull/190) [`7352bb4`](https://github.com/usequark/quark/commit/7352bb444f2e67c7841006664bf59334207a83e6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Switch the project licence from ISC to MIT. MIT carries an explicit patent grant,
  which ISC omits and which some corporate legal teams screen for when evaluating
  a framework dependency.
  
  Scaffolded projects now default to MIT as well, so a generated app inherits the
  same terms as the framework that produced it. Archived reference verticals under
  `docs/archive/` keep their original ISC markers as historical snapshots.

- [#190](https://github.com/usequark/quark/pull/190) [`7352bb4`](https://github.com/usequark/quark/commit/7352bb444f2e67c7841006664bf59334207a83e6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Point repository metadata at the `usequark/quark` GitHub org. `homepage`,
  `repository.url`, and `bugs.url` in both published packages, the changesets
  changelog repo, the CLI's user-facing output, and the contributor and
  documentation guides now reference `usequark/quark` instead of the previous
  personal account.
  
  No runtime behaviour changes.

## 2.5.3

### Patch Changes

- [#153](https://github.com/Bobnoddle/quark/pull/153) [`bdd0470`](https://github.com/Bobnoddle/quark/commit/bdd0470b3ce8100992e5a0a2bb08c37b2ec2ebb7) Thanks [@dependabot](https://github.com/apps/dependabot)! - Bump nodemailer 9→10
  
  The only breaking change in nodemailer 10 is "Node.js 20 or newer is required"
  (this repo requires ≥22). `createTransport` and the SMTP transport options
  (`host`, `port`, `secure`, `connectionTimeout`, `greetingTimeout`,
  `socketTimeout`) are unchanged, so `email.js` needs no changes.

## 2.5.2

### Patch Changes

- [#149](https://github.com/Bobnoddle/quark/pull/149) [`0b147d8`](https://github.com/Bobnoddle/quark/commit/0b147d8fbf51436c461c56cebad37cc479a816a4) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Bump bullmq to v6
  
  The queue module no longer reaches for BullMQ's removed public `queue.client`
  getter; deduplication uses BullMQ's native `deduplication` option and
  `checkQueueHealth` uses `waitUntilReady()`. See 740707b for the behavioural
  detail. Split out of dependabot [#137](https://github.com/Bobnoddle/quark/issues/137) for individual review.

- [`740707b`](https://github.com/Bobnoddle/quark/commit/740707b93545b58e20655899919e7b08f421f337) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Use BullMQ's public APIs for job deduplication and health checks
  
  `addJob`'s deduplication was hand-rolled with a raw `SET NX` against
  `queue.client`, a BullMQ internal that v6 removed. The `SET NX` then threw, a
  best-effort `catch` swallowed the error, and every "deduplicated" job was
  enqueued anyway - silently, with only a WARN in the logs. Deduplication now maps
  `dedupKey`/`dedupTTL` onto BullMQ's own `deduplication` job option, which has
  existed since v5 and matches the documented return contract (a duplicate
  resolves to the already-queued job).
  
  `checkQueueHealth` used the same removed getter to ping Redis, so on v6 it
  reported a healthy Redis as unavailable and worker preflight would fail. It now
  uses `waitUntilReady()`, the supported readiness primitive, which behaves the
  same on v5 and v6.
  
  Neither change alters behaviour on the pinned bullmq 5: verified 547/547 core
  tests pass on 5.70.4, and on 6.3.9 the fix passes where the previous code fails
  the close-safety test and silently loses deduplication.

## 2.5.1

### Patch Changes

- [#147](https://github.com/Bobnoddle/quark/pull/147) [`fae41f2`](https://github.com/Bobnoddle/quark/commit/fae41f280b90f1695d877b825ae79d31c874a75d) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Make `createQueue()` close-safe and drop dead queue churn from worker preflight.
  
  - `createQueue(name)` now evicts a queue from the singleton registry when it is closed, so the next `createQueue(name)` returns a fresh, usable instance instead of the poisoned, already-closed one. Queues closed through another path are also detected and replaced, and `closeAllQueues()` iterates a snapshot of the registry while close evicts entries.
  - The worker `preflight()` health check no longer creates and immediately closes a queue per job queue — that code never used the queue and taught an unsafe pattern by example. Handler registration is now counted directly from the handler registry.

## 2.5.0

### Minor Changes

- [#143](https://github.com/Bobnoddle/quark/pull/143) [`67cfc3b`](https://github.com/Bobnoddle/quark/commit/67cfc3bb636e5d76cafd603833b5bf1d6e54bce5) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add `admin`, `auth/middleware`, `core`, `db`, `email`, `metrics`, `queue`, `sms`, and `storage/s3` subpath exports. The S3 adapter now lives in its own module and loads the optional `@aws-sdk/*` peer dependencies lazily, so `@techstream/quark-core/storage` and the main barrel no longer require them at import time. `pingDatabase()` imports its optional `pg` peer lazily for the same reason, and `createPrismaClient()` namespaces its singleton per client instead of sharing one global slot. Existing `./locale`, `./logger`, and `./stripe` subpaths are unchanged.

## 2.4.3

### Patch Changes

- [#130](https://github.com/Bobnoddle/quark/pull/130) [`b3d07b4`](https://github.com/Bobnoddle/quark/commit/b3d07b4133bea19da7693b43fab2cced1cfb85cb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Apply optional chaining refactors and sync templates after Biome 2.5 upgrade

## 2.4.2

### Patch Changes

- [#99](https://github.com/Bobnoddle/quark/pull/99) [`877a16e`](https://github.com/Bobnoddle/quark/commit/877a16e1a492b1366ddabb1672383318905b4710) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add Stripe integration utility (createStripeClient, getStripeWebhookEvent) as optional peer dependency.

- [#119](https://github.com/Bobnoddle/quark/pull/119) [`f2ff17b`](https://github.com/Bobnoddle/quark/commit/f2ff17be10b869aa117decaa5b3bd80b6748c508) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Exempt Bearer-authenticated requests from CSRF protection — mobile app push registration no longer fails with 401

- [#127](https://github.com/Bobnoddle/quark/pull/127) [`bc56633`](https://github.com/Bobnoddle/quark/commit/bc56633a06d90d173f81cc8933b3f1651a5dac7e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Keep S3 storage imports available in standalone deployments.

## 2.4.1

### Patch Changes

- [`4b8c677`](https://github.com/Bobnoddle/quark/commit/4b8c67786939bdc9ca7239ecf8fd3162431714b8) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add a browser-safe `./logger` subpath export. The main barrel re-exports node-only modules (redis, queue, email) that Turbopack cannot bundle into client components; `@techstream/quark-core/logger` exposes only the zero-dependency logger so client-side code can use `createLogger()` without pulling the server-only graph.

- [`d3dd09e`](https://github.com/Bobnoddle/quark/commit/d3dd09e89e28498c6080a76d7ec267b20b229e5c) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Auth: `isDeployed()` now honors `AUTH_TRUST_HOST` only when set to the literal string `"true"` — previously any truthy value (including `"false"`) enabled `trustHost`

## 2.4.0

### Minor Changes

- [`c20e541`](https://github.com/Bobnoddle/quark/commit/c20e541b3c6690fda859b1c2b997b81ddea280bf) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - AI chat system, UI theming engine, SMS service, CRM package, and expanded deployment tooling

  **@techstream/quark-core**

  - New SMS service module with pluggable provider pattern (Twilio built-in, custom provider registry via `registerSmsProvider`)
  - New admin authentication module (`admin-auth.js`) for admin-only route protection
  - New database instrumentation module (`db-instrumentation.js`) with Prometheus metrics (`db-metrics.js`) for query monitoring
  - Queue improvements: `addRepeatableJob` utility using atomic `upsertJobScheduler`, `dedupKey` support for job deduplication with configurable TTL, `removeOnComplete` retention settings
  - Auth: `trustHost` auto-detection for Railway and non-localhost deployments
  - Dependency: nodemailer ^7 → ^9

  **@techstream/quark-create-app**

  - AI chat system: persistent conversations with Claude-style UI (sidebar, message bubbles, streaming indicators), rate limiting, truncation, OpenCode integration, context extraction, permission-based tool routing with full test suites, `throw new Error` → `AppError` in handler
  - UI theming engine: refactor all 20+ components to CSS custom properties, ship 8 design preset themes (brutalist-yellow, red-noir, editorial-coral, soft-wellness, playful-geometric, hyper-saturated, season-04, swiss-minimalist), design-system skill for AI agents
  - CRM package: pipeline tracking with Kanban board, stage columns, client_admin role, config and validation
  - OpenCode deployment templates: server config, agent prompts, skills (accessibility, audience-research, data-analysis, distribution, skill-builder), MCP tools (getTasks, getRelevantContext)
  - Admin UI: new image picker component, sidebar redesign, theme toggle, db-health route, action toast notifications
  - CMS: page builder drag-and-drop improvements, cover image field refactor, cms-public scaffold split for cleaner project structure
  - Auth: PasswordInput with visibility toggle, trustHost detection in scaffolded auth config
  - Umami analytics: Core Web Vitals tracking component, replay recorder component
  - Config: environment validation for AI features, SEO indexing gate hardened (dual `NODE_ENV` + `ALLOW_INDEXING` check), `pnpm.overrides` restore in scaffolded package.json
  - DB: conversation summary model, context model, AI/CRM model migrations, context.js utility with test suite
  - Railway deployment: service validation before deploy, .env.railway.example template, check-loading script, deploy integration test fixes
  - Security: Docker base image bump for CVE-2026-45447, Dockerfile `apk upgrade` stage, nodemailer bump

### Patch Changes

- [#58](https://github.com/Bobnoddle/quark/pull/58) [`1b38b14`](https://github.com/Bobnoddle/quark/commit/1b38b140456470b4add3e9c2bde2f7bf3d16891b) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Enhanced media management UI with inline image editing, drag-and-drop page builder improvements, and admin navigation updates

## 2.3.3

### Patch Changes

- [#47](https://github.com/Bobnoddle/quark/pull/47) [`8be648c`](https://github.com/Bobnoddle/quark/commit/8be648cd739c843c905ec2fce541875d8e00b094) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Add the expanded playground and scaffolded UI component updates to `quark-create-app`, harden scaffold parity with runtime standards checks, JavaScript Prisma config support, and worker/auth validation improvements, and ship the related auth-secret fallback and storage path handling fixes in `quark-core`.

## 2.3.2

### Patch Changes

- [`274bf3d`](https://github.com/Bobnoddle/quark/commit/274bf3dabacc7c517561512c7ddf0e8379d0b09a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Export the documented `auth`, `errors`, and `storage` subpaths from `@techstream/quark-core`, and update scaffolded app manifests so installs set up git hooks without module-type or ignored-build-script warnings.

## 2.3.1

### Patch Changes

- [`a12ccd7`](https://github.com/Bobnoddle/quark/commit/a12ccd7d8dc21a778e98bb9826b5b9a80c55c291) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix `pingRedis` to use `resolveRedisConnection()` instead of a raw `getRedisUrl()` string.

  Previously, `pingRedis` called `new Redis(url, options)` with the URL string from `getRedisUrl()`, which bypassed the structured `resolveRedisConnection()` path that correctly handles `REDIS_HOST`/`REDIS_PORT`, password decoding, and TLS (`rediss://`). The fix uses the same options-object form as the rest of the queue module.

## 2.3.0

### Minor Changes

- [`ae1a152`](https://github.com/Bobnoddle/quark/commit/ae1a152758df1616959f38586f13b31a94919293) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add pagination utilities: `parsePagination`, `paginationToSkip`, `paginationMeta`, and `parsePaginationQuery`. These offset-based helpers integrate with Prisma's skip/take API and throw `ValidationError` on invalid input so existing route error handlers catch them automatically.

### Patch Changes

- [`b07c53a`](https://github.com/Bobnoddle/quark/commit/b07c53af1ef756e0dfb89a03ee011f7a91406438) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - **CLI:** Add `--admin-routes` scaffold flag that generates a full admin panel - CRUD route handlers, field renderer, model table/form components, sidebar, sign-out button, and a dashboard data helper. Admin template now ships with `field-map`, `introspect`, and `query` utilities.

  **CLI:** Update `ui` template with `ErrorBanner`, `RichText`, and updated `ThemeProvider`/theme toggle components. Update `base-project` template with registration, forgot-password, and sign-out auth pages, a floating theme toggle, and revised seed/query helpers. Update `worker` template with default email and file job handlers.

  **Core:** Pre-register queue metrics as named exports from `@techstream/quark-core`: `jobQueueDepth` (gauge), `jobsProcessedTotal` (counter), and `jobDuration` (histogram). Wire `completed` and `failed` worker event handlers to record these metrics automatically. Add `getRegisteredQueues()` and `updateQueueDepths()` helpers so workers can periodically refresh the queue-depth gauge.

## 2.2.1

### Patch Changes

- [`9c7ea5f`](https://github.com/Bobnoddle/quark/commit/9c7ea5fbf92037fca1a3193de27e2139d8edba30) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## @techstream/quark-create-app

  ### UI Component Library - scaffolded projects now include a full component set

  New projects scaffolded with `create-quark-app` now include a complete `ui` package with all core primitives and their tests:

  - `Textarea`, `Badge`, `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`
  - `Checkbox`, `Dialog` (client), `Input`, `Label`, `Select`, `Skeleton`
  - `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`
  - `Toast`/`useToast` (client)
  - Theme constants and theme utilities

  ### Worker - email and file job handlers included by default

  The scaffolded `worker` package now ships with ready-to-use job handlers:

  - `handlers/email.js` - handles `sendEmail` jobs via the core email service
  - `handlers/files.js` - handles `processFile` jobs
  - `handlers/index.js` - handler registry
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

  - Redis error handling streamlined (`redis.js`, `queue/index.js`) - no breaking API changes

## 2.2.0

### Minor Changes

- [`fb110e7`](https://github.com/Bobnoddle/quark/commit/fb110e755664ac70ccea7d768a35bd87f72c1492) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - ## @techstream/quark-core

  ### Email - pluggable provider system

  The email service has been refactored to use a **Strategy Pattern**. A new `EmailProvider` base class is now exported, along with a `registerEmailProvider()` function so applications can plug in any email provider.

  Built-in providers:

  - `smtp` - Nodemailer (unchanged behaviour)
  - `resend` - Resend API (unchanged behaviour)
  - `zeptomail` - **new** ZeptoMail provider (set `EMAIL_PROVIDER=zeptomail` + `ZEPTOMAIL_TOKEN`)

  Custom providers can be registered at startup and used transparently:

  ```js
  import { EmailProvider, registerEmailProvider } from "@techstream/quark-core";

  class SendGridProvider extends EmailProvider {
    async sendEmail(to, subject, html, text) { … }
  }
  registerEmailProvider("sendgrid", SendGridProvider);
  ```

  ### Storage - pre-signed S3 upload URLs

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

  ### New utility - `formatProjectDisplayName()`

  A new `formatProjectDisplayName(name)` utility converts a kebab-case project slug to a human-readable title (e.g. `my-cool-app` → `My Cool App`). It is used internally during scaffolding and is exported for use in scripts.

  ### Scaffolded project improvements

  - **`.env.example`** - improved structure and comments: copy-paste instructions at the top, ZeptoMail config block, database pool notes, and `WORKER_CONCURRENCY` variable documented.
  - **`validate-env.js`** - new optional env vars recognised: `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_URL`, `ZEPTOMAIL_BOUNCE_EMAIL`, `APP_DESCRIPTION`, `WORKER_CONCURRENCY`.
  - **Health check** (`/api/health`) - now verifies storage connectivity in addition to database and Redis.
  - **Admin package scaffolding** - `pnpm create quark-app` now includes the admin UI package scaffold.
  - **`nano-staged` / `simple-git-hooks`** - updated linting hooks in the scaffolded template.

## 2.1.3

### Patch Changes

- [`68c1aa1`](https://github.com/Bobnoddle/quark/commit/68c1aa12253d66779620b18654a8dc8b6baa8d81) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add worker service resilience utilities and preflight health checks:

  - **New Utilities:**

    - `isConnectionError()` - Detect connection failures (ECONNREFUSED, ECONNRESET, ENOTFOUND, ETIMEDOUT, etc.)
    - `throttledError()` - Deduplicate identical errors within time window to prevent log spam during outages
    - `waitForRedis()` - Retry health checks with exponential backoff before worker startup

  - **New Features:**

    - `preflight()` mode for deployment readiness checks (health check via `--preflight` flag)
    - Graceful shutdown with 30-second drain timeout
    - Comprehensive error classification for connection vs. job processing errors

  - **Testing:**

    - 17 new test cases covering all resilience utilities
    - Full coverage of error detection, throttling, and health check patterns
    - All tests passing (31 total)

  - **Documentation:**
    - Complete README with architectural patterns and deployment examples
    - Code examples for integration and testing
    - Development experience improvements with local setup guidance

## 2.1.2

### Patch Changes

- [`e41d79e`](https://github.com/Bobnoddle/quark/commit/e41d79e8a44b2a4d1a0799ca1fecc282b58b4524) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Refactor database connection string logic and enhance environment validation:

  - **feat:** Add Railway deployment configuration for web and worker services with health checks and restart policies
  - **feat:** Enhance environment validation with service-scoped checks (web/worker) and cross-field validation
  - **feat:** Add APP_NAME configuration variable for metadata, emails, and page titles
  - **feat:** Centralize PostgreSQL connection string builder in shared module (`connection.js`)
  - **refactor:** Simplify database client and Prisma config to use shared connection builder
  - **refactor:** Update mail configuration for local development (Mailpit) with cleaner env var handling
  - **test:** Add comprehensive unit tests for PostgreSQL connection string builder covering all scenarios
  - **chore:** Update Biome schema to 2.4.2

## 2.1.1

### Patch Changes

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

## 2.1.0

### Minor Changes

- [`5069069`](https://github.com/Bobnoddle/quark/commit/50690698d4fe1daeaa7f5b49bfb20a97074a2744) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add query builder utilities with search/sort support and introduce request/response logging middleware. Improve CLI docs and add optional build verification test, plus checklist updates.

## 2.0.0

### Major Changes

- [`0817b68`](https://github.com/Bobnoddle/quark/commit/0817b6841f29e5b3144a9475a592b7fc93b6c4e1) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - refactor: replace Mailhog-specific configuration with generic mail service support

  **BREAKING CHANGES:**

  - Renamed `getMailhogSmtpConfig()` to `getMailSmtpConfig()`
  - Renamed `getMailhogSmtpUrl()` to `getMailSmtpUrl()`
  - Renamed `getMailhogUiUrl()` to `getMailUiUrl()`
  - Renamed environment variables:
    - `MAILHOG_SMTP_URL` → `MAIL_SMTP_URL`
    - `MAILHOG_HOST` → `MAIL_HOST`
    - `MAILHOG_SMTP_PORT` → `MAIL_SMTP_PORT`
    - `MAILHOG_UI_PORT` → `MAIL_UI_PORT`
  - Deleted `packages/core/src/mailhog.js` module
  - Added `packages/core/src/mail.js` with provider-agnostic API

  This change makes the mail service configuration generic and compatible with multiple SMTP providers (Mailpit, Mailhog, etc.) instead of being Mailhog-specific.

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
