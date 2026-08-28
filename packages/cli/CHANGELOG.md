# @techstream/quark-create-app

## 1.20.0

### Minor Changes

- [#87](https://github.com/Bobnoddle/quark/pull/87) [`3ed5109`](https://github.com/Bobnoddle/quark/commit/3ed510924b99e7efdbf09c197cba445806ee61f6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Bundle all embedded skills with every scaffold and remove the admin dashboard UI. The CLI no longer asks which skills to include — features are now `ui` and `jobs` only, and all skills (including a new `admin-dashboard` skill preserving the CRUD-generation patterns and a `quark-skills` index) ship with every build. The `admin`, `bookings`, `crm`, `cms`, and `ai` feature flags are removed; the dev seed no longer inserts domain-specific demo data; the scaffolded README now includes the `pnpm db:seed` step.

- [#83](https://github.com/Bobnoddle/quark/pull/83) [`2af89ff`](https://github.com/Bobnoddle/quark/commit/2af89ff6409fe6fa8904c52cccefaeeee4d68cbb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: make embedded skills harness-generic via --harness flag

  The embedded skills are no longer opencode-specific. The CLI now accepts a
  `--harness <opencode|claude|copilot>` flag (default `opencode`) and places the
  skills in the selected harness's auto-load directory (`.opencode/skills/`,
  `.claude/skills/`, or `.github/skills/`). The scaffolded docs and feature rows
  reference the selected harness's skill directory.

- [#85](https://github.com/Bobnoddle/quark/pull/85) [`c732267`](https://github.com/Bobnoddle/quark/commit/c73226748f76b554a35345b005fbe9a95eaf8a3b) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Standardize scaffolded page-title convention: add getPageMetadata() helper to the web SEO lib, switch the title template separator from "·" to "|", and document page-title formulas in the seo skill and project context files.

### Patch Changes

- [#83](https://github.com/Bobnoddle/quark/pull/83) [`2af89ff`](https://github.com/Bobnoddle/quark/commit/2af89ff6409fe6fa8904c52cccefaeeee4d68cbb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - docs: enrich booking/CMS skills; remove stale vertical + agency docs

  - **Enriched the bookings skill** with the full booking schema (Staff, ServiceType, AvailabilitySlot, Booking), the booking status state machine, and scheduling rules.
  - **Enriched the CMS skill** with the content status lifecycle and media library model.
  - **Removed stale vertical docs** (`BOOKING-SYSTEM-DESIGN.md`, `CMS_OUTLINE.md`) — their domain knowledge is now in the skills.
  - **Removed agency docs** (Techstream pricing/marketing/strategy) and the stale business pitch — they belong in a separate repo.
  - **Removed leftover artifacts** (`technical-task.html`, `PLAN.md`, `PLAN_SUMMARY.md` archived to `reference/`).

- [#88](https://github.com/Bobnoddle/quark/pull/88) [`36c9ced`](https://github.com/Bobnoddle/quark/commit/36c9ced83208254190e9295db17af7b3077a9fa9) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - docs: replace remaining recipe terminology with skills across docs, CLI comments, and the reference archive README

- [#89](https://github.com/Bobnoddle/quark/pull/89) [`e14a134`](https://github.com/Bobnoddle/quark/commit/e14a1349843fec1ea24af02efe5a3841646b9aee) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Slim template footprint by excluding test files from scaffolded projects, reducing globals.css to essential design tokens, and trimming the example page. The sync-templates engine now removes locally-excluded files from templates (not just skips syncing them). Stale planning docs archived.

- [#86](https://github.com/Bobnoddle/quark/pull/86) [`ec97a10`](https://github.com/Bobnoddle/quark/commit/ec97a10d11ad6003daa31585b72952beafc5cccb) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Sync pnpm.overrides from the monorepo root into the scaffold root template so scaffolded projects pick up security overrides (deepmerge-ts, fast-uri) and stop failing Trivy image scans.

## 1.19.1

### Patch Changes

- [#81](https://github.com/Bobnoddle/quark/pull/81) [`3834d86`](https://github.com/Bobnoddle/quark/commit/3834d869df94d1edc1b5d0a389ca3ae01fbfc002) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(smoke): approve msgpackr-extract build in standalone core check

  pnpm 10+ ignores build scripts not explicitly allowed, so the standalone core
  smoke check (`pnpm add @techstream/quark-core next react react-dom`) failed with
  `ERR_PNPM_IGNORED_BUILDS` for the transitive `msgpackr-extract` dependency. The
  smoke test now passes `--allow-build=msgpackr-extract`.

## 1.19.0

### Minor Changes

- [#79](https://github.com/Bobnoddle/quark/pull/79) [`900c3b7`](https://github.com/Bobnoddle/quark/commit/900c3b75425b8e29c209b5f463f8802e0617ecca) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: archive vertical packages and remove vertical code from the monorepo

  - **Archived the vertical packages** (`@techstream/quark-ai`, `@techstream/quark-cms`, `@techstream/quark-crm`, `@techstream/quark-bookings`) to `reference/verticals/packages/`. They are now reference implementations only — the skills point to them.
  - **Removed the vertical code from the monorepo's apps**: the AI/CRM/bookings API routes, the CMS content subsystem, and the worker AI handlers are gone from `apps/web` and `apps/worker`. The monorepo now reflects the minimal scaffold (infrastructure + skills).
  - The scaffold was already clean; this removes the vertical code from the monorepo's own reference apps.

- [#79](https://github.com/Bobnoddle/quark/pull/79) [`900c3b7`](https://github.com/Bobnoddle/quark/commit/900c3b75425b8e29c209b5f463f8802e0617ecca) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: make verticals skill-only; embed skills in .opencode/skills; rename recipe → skill

  - **Verticals are now skill-only**: `bookings`, `crm`, `cms`, and `ai` no longer scaffold starter code. Selecting one just recognizes the feature — the embedded skill (always present) teaches the AI to build it. The starter templates are archived to `reference/verticals/`.
  - **Skills embedded for auto-loading**: the skills moved from `skills/` to `.opencode/skills/`, the location opencode auto-loads on context match (no need to point the AI at them).
  - **`recipe` command renamed to `skill`**: `quark skill <feature>` prints an embedded skill.
  - **Skills enriched**: each vertical skill now includes example Prisma models, Zod validation schemas, and test patterns.
  - **Smoke test expanded**: verifies all embedded skills are present and the `skill` command works.

### Patch Changes

- [#79](https://github.com/Bobnoddle/quark/pull/79) [`900c3b7`](https://github.com/Bobnoddle/quark/commit/900c3b75425b8e29c209b5f463f8802e0617ecca) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(cli): make ui a required package so minimal scaffolds work

  The base web app (layout, auth, example-page) imports the `ui` package, but a
  minimal scaffold (`--features ""` or `--preset minimal`) did not include it,
  producing a broken scaffold that failed `pnpm doctor:ci`. `ui` is now always
  scaffolded (alongside `db` and `config`), and the web app dependency + `.quark-link.json`
  reflect it so the doctor check passes.

## 1.18.0

### Minor Changes

- [#78](https://github.com/Bobnoddle/quark/pull/78) [`234359a`](https://github.com/Bobnoddle/quark/commit/234359a2e13bc61a6d107397a0cdfeaafc7880c6) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: replace recipes with embedded skills; archive bookings; remove worker AI subsystem

  - **Embedded skills**: replaced the `recipes/` prompt library with a `skills/` directory in the base scaffold. Ships skills for building bookings, CRM, CMS, and AI systems, plus generic skills (add-model, add-endpoint, add-dashboard). Each skill carries the domain context, Quark framework patterns, workflow, end-result shape, and a pointer to the archived reference implementation.
  - **CLI**: the `recipe` command now reads from `skills/`; feature rows/guides reference `skills/`; starter detection checks the API route instead of a recipe file.
  - **Archive bookings**: copied the bookings starter to `reference/verticals/bookings/` as the skill's reference.
  - **Worker AI subsystem removed**: the scaffolded worker no longer ships AI handlers/libs (`context-extraction`, `conversation-compact`, `openrouter`, `summarize`, `truncation`, `tools`) or AI job names — the AI skill teaches how to build them.
  - **Smoke test**: added a minimal-scaffold check that verifies the base scaffold has no demoted-vertical references and ships the embedded skills.

### Patch Changes

- [#76](https://github.com/Bobnoddle/quark/pull/76) [`6d037b3`](https://github.com/Bobnoddle/quark/commit/6d037b360b0959dd58b62903c01604650913af4f) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(scaffold): remove demoted vertical refs from base template; fix starter paths; add --skip-install to add

  - Removed orphaned references to the demoted vertical packages (`quark-ai`, `quark-cms`, `quark-crm`) from the base scaffold (web/worker `package.json`, `next.config` transpilePackages, `api/ai` + `api/admin/crm` routes, worker `ai.js`/`ai.test.js`). These are now AI skills, not scaffolded packages.
  - Fixed a wrong relative import in all four domain starters (`bookings`, `crm`, `cms`, `ai`): `route.js` used `../../error-handler` (resolved to `app/error-handler`, wrong) instead of `../error-handler`. This broke `pnpm build`.
  - Added `--skip-install` support to the `add` command (previously ignored due to a commander option-shadowing quirk), fixing a flaky `add <feature>` test that timed out during dependency installation.

## 1.17.1

### Patch Changes

- [#74](https://github.com/Bobnoddle/quark/pull/74) [`7e4c315`](https://github.com/Bobnoddle/quark/commit/7e4c31586e942034ca78ed1a1675b27226a41b81) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(scaffold): scaffolded web tests fail out of the box

  A freshly scaffolded project's `pnpm test` failed because the web test script
  (`node --test 'src/**/*.test.js'`) was missing the `--experimental-test-module-mocks`
  flag and ran integration tests that the monorepo excludes. The scaffold now ships
  `scripts/run-tests.mjs` (matching the monorepo runner) and the web test script uses
  `node ../../scripts/run-tests.mjs src --exclude=integration.test.js`. Scaffolded web
  tests pass 56/56 and db tests 52/52.

## 1.17.0

### Minor Changes

- [#71](https://github.com/Bobnoddle/quark/pull/71) [`592e0ea`](https://github.com/Bobnoddle/quark/commit/592e0ea81a41cc61b49b1834f0985e319a47998a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - feat: scaffold opinionation reduction — API-first, two-view CLI, minified admin + verticals

  Quark becomes API-first with AI-assisted scaffolding:

  - **Two-view CLI**: Human View (product-shaped questions + advanced config) and AI View (`--features`, `--preset`, `--prompt`, `--no-prompts`), plus a `recipe <feature>` command that prints an AI prompt recipe.
  - **Minified admin**: neutral operations shell (`_patterns/` Dashboard/ActionForm/DeployPanel + auto-CRUD fallback), no themed UI imports, no design-language leak into user pages.
  - **Verticals → domain starters**: bookings/crm/cms/ai are now generic endpoint + Prisma model + recipe, scaffolded on demand instead of full packages.
  - **Prompt Library**: `recipes/` core set (add-model, add-endpoint, add-dashboard) + per-feature recipes.
  - **`MAIN.md`**: single agent entry point linking CLAUDE.md, docs/, openapi.yaml, and recipes/.
  - **Package scope reduction**: verticals removed from the default feature list; originals archived to `reference/`.
  - **Fixes**: pass model name to `isListVisible` so per-model hidden fields are honored; fix `MAIN.md` brief placeholder replacement.

### Patch Changes

- [#64](https://github.com/Bobnoddle/quark/pull/64) [`66b8cb6`](https://github.com/Bobnoddle/quark/commit/66b8cb6819bbf884e02c0cc0c3b55d07b9adb599) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - fix(ci): auto-sync scaffold templates during release to prevent drift

  The release workflow bumps package versions via changesets but never
  re-synced scaffold templates, so every release created template drift
  that blocked unrelated PRs. Templates are now re-synced inside the
  changesets version step, and CHANGELOG.md files are excluded from sync
  since they are release artifacts, not scaffold content.

## 1.16.0

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

- [#58](https://github.com/Bobnoddle/quark/pull/58) [`1b38b14`](https://github.com/Bobnoddle/quark/commit/1b38b140456470b4add3e9c2bde2f7bf3d16891b) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Enhanced media management UI with inline image editing, drag-and-drop page builder improvements, and admin navigation updates

### Patch Changes

- [`1191466`](https://github.com/Bobnoddle/quark/commit/119146639f0e53028ebe0a999ecc3008dd23ce67) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix OpenRouter error classification and max-rounds behavior in AI worker

  - **Error classification**: Change remaining `AppError` throws in the streaming code path to `ServiceError("OpenRouter", ...)` for proper external-service error handling (OpenRouter API errors, missing response body, retry exhaustion)
  - **Graceful max-rounds**: Replace `throw new AppError` when the tool-calling loop exceeds 20 rounds with a graceful return that includes `truncated: true` and an assistant hint message, preventing conversation crashes

## 1.15.0

### Minor Changes

- [`9e85dba`](https://github.com/Bobnoddle/quark/commit/9e85dba8de2031c91eb129c459110cb105d87fce) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Refactor CMS page builder by removing background animation support in favor of a simpler color-only background model, add HTML sanitization utilities, and replace the `section`/`photo-gallery`/`form` UI components with more focused `container`/`lightbox`/`form-field` alternatives across scaffolded projects.

- [`ad311a8`](https://github.com/Bobnoddle/quark/commit/ad311a8967c32b13c5f5d16303f6cc57dc2abd3a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Improve the scaffold DX in `quark-create-app` with clearer onboarding docs, feature-specific scaffold guidance, and a read-only scaffold drift checker with CI-friendly failure mode.

### Patch Changes

- [#54](https://github.com/Bobnoddle/quark/pull/54) [`799f9ba`](https://github.com/Bobnoddle/quark/commit/799f9ba87f8797d75ce3526ac5379975417cd7c1) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Fix scaffolded route generation and tests for page-content migration behavior, and align build-time slug prerendering with CI environments that do not provide database variables.

## 1.14.0

### Minor Changes

- [#47](https://github.com/Bobnoddle/quark/pull/47) [`8be648c`](https://github.com/Bobnoddle/quark/commit/8be648cd739c843c905ec2fce541875d8e00b094) Thanks [@Mattyfegan](https://github.com/Mattyfegan)! - Add the expanded playground and scaffolded UI component updates to `quark-create-app`, harden scaffold parity with runtime standards checks, JavaScript Prisma config support, and worker/auth validation improvements, and ship the related auth-secret fallback and storage path handling fixes in `quark-core`.

## 1.13.4

### Patch Changes

- [`e9411f9`](https://github.com/Bobnoddle/quark/commit/e9411f9e1d91ad13cb496e4645d15ba2aff6080d) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Split CMS into an explicit scaffold feature instead of bundling it into `admin`, automatically include its current dependencies, and make generated admin routes work cleanly when CMS is not installed.

## 1.13.3

### Patch Changes

- [`3cecbed`](https://github.com/Bobnoddle/quark/commit/3cecbeddf1a5764c72688ed0d36c52c95a16eae5) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Update scaffolded Railway web deployment guidance to use the correct Next.js standalone server path and preserve static/public assets during the build so production CSS and JS load correctly.

## 1.13.2

### Patch Changes

- [`d49c064`](https://github.com/Bobnoddle/quark/commit/d49c0649e6e8759eb1a8abd37887dabe8aaaffdf) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Preserve NextRequest semantics when normalizing forwarded development auth requests in scaffolded apps.

- [`274bf3d`](https://github.com/Bobnoddle/quark/commit/274bf3dabacc7c517561512c7ddf0e8379d0b09a) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Export the documented `auth`, `errors`, and `storage` subpaths from `@techstream/quark-core`, and update scaffolded app manifests so installs set up git hooks without module-type or ignored-build-script warnings.

## 1.13.1

### Patch Changes

- [`5a360a9`](https://github.com/Bobnoddle/quark/commit/5a360a979d1a021969680386b4f9adfbc3335308) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Fix admin scaffolding so Quark create and add also include the CMS package and routes, rewrite generated workspace package names consistently, and keep optional package dependencies installable in generated apps.

## 1.13.0

### Minor Changes

- [`cd830d9`](https://github.com/Bobnoddle/quark/commit/cd830d95a3ef66d37b2a0f28d21c910a75d84d1e) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add CMS scaffolding, media management flows, security contact metadata, and release-tooling improvements to the Quark CLI templates.

  This release also hardens template sync by excluding local uploads from generated scaffolds.

## 1.11.0

### Minor Changes

- [`b07c53a`](https://github.com/Bobnoddle/quark/commit/b07c53af1ef756e0dfb89a03ee011f7a91406438) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - **CLI:** Add `--admin-routes` scaffold flag that generates a full admin panel - CRUD route handlers, field renderer, model table/form components, sidebar, sign-out button, and a dashboard data helper. Admin template now ships with `field-map`, `introspect`, and `query` utilities.

  **CLI:** Update `ui` template with `ErrorBanner`, `RichText`, and updated `ThemeProvider`/theme toggle components. Update `base-project` template with registration, forgot-password, and sign-out auth pages, a floating theme toggle, and revised seed/query helpers. Update `worker` template with default email and file job handlers.

  **Core:** Pre-register queue metrics as named exports from `@techstream/quark-core`: `jobQueueDepth` (gauge), `jobsProcessedTotal` (counter), and `jobDuration` (histogram). Wire `completed` and `failed` worker event handlers to record these metrics automatically. Add `getRegisteredQueues()` and `updateQueueDepths()` helpers so workers can periodically refresh the queue-depth gauge.

## 1.10.0

### Minor Changes

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

## 1.9.0

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

## 1.8.0

### Minor Changes

- [`68c1aa1`](https://github.com/Bobnoddle/quark/commit/68c1aa12253d66779620b18654a8dc8b6baa8d81) Thanks [@Bobnoddle](https://github.com/Bobnoddle)! - Add flexible CLI options and comprehensive test coverage for project scaffolding:

  - **New CLI Flags:**

    - `--no-prompts` - Non-interactive project creation for CI/CD and automation
    - `--features <list>` - Selective package scaffolding (default: `ui,jobs`; valid: `ui`, `jobs`)
    - `--skip-install` - Skip `pnpm install` step during scaffolding for faster iterations
    - `--skip-docker` - Skip Docker volume cleanup for development workflows

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
