# Quark Project - Complete Implementation Checklist

This document contains a comprehensive list of all missing features, issues, and tasks needed to bring Quark to production. Tasks are organized by priority level.

**Total Tasks:** 100 (72 complete, 28 remaining)
**P1 (Critical):** ✅ 100% | **P2 (High):** ✅ 100% | **P3 (Medium):** 86% | **P4 (Low):** 0%

---

## PRIORITY 1: CRITICAL (App Won't Work Without These)

### Infrastructure & Setup

- [x] **Sync pnpm lockfile**
  - Issue: Workspaces `packages/core` and `packages/cli` missing from pnpm-lock.yaml
  - Solution: Run `pnpm install`

- [x] **Fix package.json main fields**
  - Issue: `packages/config` and `packages/db` point to `.ts` files that don't exist
  - Solution: Change `"main": "src/index.ts"` to `"main": "src/index.js"` in both files

- [x] **Initialize Prisma migrations**
  - Issue: Schema exists but no migrations folder
  - Solution: Create migrations directory and generate initial migration

### Database Layer

- [x] **Implement database query utilities**
  - Issue: No helper functions for CRUD operations on User/Post models
  - Files: `packages/db/src/queries.js`
  - Should export: `createUser()`, `findUser()`, `createPost()`, `updatePost()`, `deletePost()`, etc.

- [x] **Add database seeding scripts**
  - Issue: No way to populate test data
  - Files: `packages/db/scripts/seed.js` (create)
  - Should seed initial users and posts for development

### API Routes

- [x] **Create User CRUD endpoints**
  - Files: `apps/web/src/app/api/users/route.js` (create), `apps/web/src/app/api/users/[id]/route.js` (create)
  - Methods: GET (list), POST (create), PATCH/:id (update), DELETE/:id (delete)

- [x] **Create Post CRUD endpoints**
  - Files: `apps/web/src/app/api/posts/route.js` (create), `apps/web/src/app/api/posts/[id]/route.js` (create)
  - Methods: GET (list with pagination), POST (create), PATCH/:id (update), DELETE/:id (delete)

### Validation & Error Handling

- [x] **Add input validation library**
  - Install: `zod` (or valibot)
  - Create validation schemas for User and Post models in `packages/db/src/schemas.js` or similar

- [x] **Implement validation middleware**
  - Files: `packages/core/src/validation.js` (create)
  - Should validate request bodies against schemas

- [x] **Implement global error handler**
  - Files: `apps/web/src/app/api/error-handler.js` (create)
  - Should standardize error responses with consistent format (status, message, code)

- [x] **Add error handling to API routes**
  - Update all API routes to use error handler and validation

### Authentication

- [x] **Configure NextAuth providers**
  - Files: `packages/core/src/auth.js` (update) or `apps/web/src/lib/auth.js`
  - Add at least one provider (GitHub, Google) with env variables

- [x] **Implement session callbacks**
  - Update auth config with session and JWT callbacks

- [x] **Create protected route middleware**
  - Files: `apps/web/src/lib/auth-middleware.js` (create)
  - Should verify session for protected endpoints

- [x] **Protect API routes**
  - Update User/Post endpoints to require authentication where appropriate

- [x] **Add auth environment variables**
  - [x] NEXTAUTH_SECRET already present
  - [x] Add APP_URL (derives NEXTAUTH_URL automatically)
  - [x] OAuth provider keys (GITHUB_ID, GITHUB_SECRET, etc.) — user-configured per deployment

### Background Jobs

- [x] **Implement worker service**
  - Files: `apps/worker/src/index.js`
  - Initializes BullMQ, connects to Redis, starts consuming jobs

- [x] **Implement job handlers**
  - Files: `apps/worker/src/handlers/email.js`, `apps/worker/src/handlers/files.js`, `apps/worker/src/handlers/index.js`
  - [x] Basic handler structure with job dispatcher
  - [x] Extract handlers to separate files for maintainability
  - [x] Connect to email service when ready

- [x] **Add job retry logic**
  - Configured in `createQueue` defaultJobOptions (3 attempts, exponential backoff)

**NOTE:** The Prisma Job model exists for potential dual-tracking (BullMQ in Redis + database audit trail). Currently unused by the worker. Consider removing if long-term job history is not needed, or implement persistence layer if audit requirements exist.

### Email Service

- [x] **Create email service module**
  - Files: `packages/core/src/email.js`
  - Strategy Pattern: providers implement a common `EmailProvider` base class
  - Built-in providers: `smtp` (Nodemailer), `resend`, `zeptomail`
  - Provider selected via `EMAIL_PROVIDER` env var (defaults to `smtp`)
  - Config validated at service-creation time (`validateConfig()`) — fails fast at startup
  - Consistent `{ id }` return shape across all providers
  - Custom providers: extend `EmailProvider`, call `registerEmailProvider(name, Class)`

- [x] **Setup email templates**
  - Files: `packages/core/src/email-templates.js`
  - `welcomeEmail()` and `passwordResetEmail()` with HTML layout + plain-text fallback
  - XSS-safe via `escapeHtml()`, customizable app name, login URL, expiry — 20 tests

- [x] **Integrate with job processor**
  - Worker uses `welcomeEmail()` / `passwordResetEmail()` templates in job handlers
  - Registration route enqueues `SEND_WELCOME_EMAIL` job (fire-and-forget)
  - `SEND_RESET_PASSWORD_EMAIL` job handler ready for password-reset flow

- [x] **Configure providers**
  - Mailpit in dev (via Docker), any provider configurable for production
  - `EMAIL_PROVIDER=zeptomail` (recommended), `resend`, or `smtp`
  - Custom providers registered at app startup via `registerEmailProvider()`

---

## PRIORITY 2: HIGH (Required for Production)

### Security

- [x] **Exclude coverage from linting**
  - Issue: Auto-generated files flagged by Biome
  - Solution: Add `"!**/coverage/**"` to Biome `files.includes` in `biome.json`

- [x] **Add CORS configuration**
  - Files: `apps/web/src/proxy.js`, `apps/web/next.config.js`
  - Configured in middleware with environment-based allowed origins
  - Handles preflight requests and CORS headers

- [x] **Add helmet/security headers**
  - Files: `apps/web/src/proxy.js`, `apps/web/next.config.js`
  - Configured: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, CSP, HSTS, Referrer-Policy

- [x] **Implement rate limiting**
  - Files: `apps/web/src/proxy.js`
  - In-memory rate limiter (100 req/15min for API, 5 req/15min for auth endpoints)
  - NOTE: Use Redis-based rate limiting for production multi-instance deployments

- [x] **Add CSRF protection**
  - Files: `packages/core/src/csrf.js`, `apps/web/src/app/api/csrf/route.js`
  - Implemented CSRF token generation and validation
  - API endpoint to get CSRF tokens: `/api/csrf`
  - Note: NextAuth already handles CSRF for /api/auth/* routes
  - [x] Security hardening (2026-02-17): Added CSRF to file upload and registration endpoints

- [x] **Add request size limits**
  - Files: `apps/web/src/proxy.js`, `apps/web/next.config.js`
  - Default API limit: 2MB (configurable via API_BODY_SIZE_LIMIT)
  - Upload limit: 10MB (configurable via UPLOAD_SIZE_LIMIT)
  - Returns 413 Payload Too Large when exceeded
  - [x] Security hardening (2026-02-17): Removed client-controlled `x-forwarded-for` from rate limiter to prevent IP spoofing

- [x] **Harden file storage against path traversal**
  - Files: `packages/core/src/storage.js`
  - Added `safePath()` validation in local storage adapter
  - Rejects keys that escape baseDir via `../` or absolute paths
  - 5 new tests for traversal rejection and nested subdirectory safety

- [x] **Enforce strong secrets validation**
  - Files: `packages/config/src/validate-env.js`
  - NEXTAUTH_SECRET must be at least 32 characters
  - Clear error message on validation failure
  - 2 new tests for minimum length enforcement

### Logging & Monitoring

- [x] **Add structured logging**
  - Custom zero-dependency structured logger in `packages/core/src/logger.js`
  - JSON output in production, colorized in dev, LOG_LEVEL env var support
  - `createLogger()`, `logger.child()`, `requestLogger()` — 14 tests

- [x] **Add request logging middleware**
  - `requestLogger(req)` creates child logger with method, url, requestId
  - Extracts `x-request-id` header or generates UUID

- [x] **Add error tracking**
  - Adapter-based `ErrorReporter` in `packages/core/src/error-reporter.js`
  - Console adapter by default, `createSentryAdapter()` stub for production
  - Breadcrumbs, user context, `report()`, `captureMessage()` — 17 tests

- [x] **Add health check endpoint**
  - Files: `apps/web/src/app/api/health/route.js`
  - [x] DB connectivity check
  - [x] Redis ping check (actual PING via `pingRedis()` with latency measurement)
  - 5-second overall timeout, returns "degraded" when dependencies are down

- [x] **Add application metrics**
  - `MetricsRegistry` with counters, gauges, histograms in `packages/core/src/metrics.js`
  - Pre-registered HTTP metrics: `httpRequestsTotal`, `httpRequestDuration`, `httpRequestsInFlight`, `appErrorsTotal`
  - Prometheus exposition format via `metrics.serialize()`
  - `/api/metrics` endpoint at `apps/web/src/app/api/metrics/route.js`
  - Factory: `createMetrics()`, singleton: `metrics` — 23 tests

### Database & Caching

- [x] **Configure database connection pooling**
  - `getPoolConfig()` in `packages/db/src/client.js` reads DB_POOL_MAX, DB_POOL_IDLE_TIMEOUT, DB_POOL_CONNECTION_TIMEOUT
  - Defaults: 10 connections in prod, 5 in dev, 30s idle timeout, 5s connection timeout
  - Pool config passed to `PrismaPg` adapter

- [x] **Add Redis client initialization**
  - Files: `packages/core/src/redis.js`, `packages/core/src/rate-limiter.js`
  - [x] Build Redis connection config from env
  - [x] Create Redis-based rate limiter for production
  - [x] Fallback to in-memory for development
  - Usage: Set REDIS_URL to enable Redis rate limiting

- [x] **Implement query result caching**
  - `createCache(redisClient, options)` in `packages/core/src/cache.js`
  - `get()`, `set()`, `del()`, `getOrSet()`, `wrap()`, `invalidate()` — 14 tests

- [x] **Add cache invalidation strategy**
  - `invalidate(pattern)` deletes all keys matching a glob pattern via Redis SCAN
  - `wrap()` creates cached function wrappers with configurable TTL and key generation

- [x] **Add database connection health checks**
  - Health check endpoint runs `SELECT 1` against PostgreSQL
  - `pingRedis()` in `packages/core/src/redis.js` for Redis health with latency

### Configuration & Environment

- [x] **Add config validation**
  - Files: `packages/config/src/validate-env.js`
  - [x] Validate environment variables on startup
  - [x] Auto-generate secure secrets in CLI (`packages/cli/src/index.js`)
  - [ ] Zod-based schema (if desired for runtime type safety)

- [x] **Document all environment variables**
  - Files: `.env.example`
  - Added comprehensive documentation with security warnings
  - Includes all required variables with descriptions

- [x] **Add environment-specific configs**
  - `packages/config/src/environment.js` with dev/test/staging/production defaults
  - `resolveEnvironment()` with aliases (dev→development, prod→production, etc.)
  - `getEnvironmentConfig()`, `mergeConfig()`, `ENVIRONMENTS` constant
  - Per-environment: rate limits, cache TTL, logging, DB pool, security, feature flags — 32 tests

- [x] **Add configuration loader**
  - Files: `packages/config/src/load-config.js`
  - `loadConfig(overrides, options)` — validates env vars, resolves environment, merges defaults + env overrides + user overrides
  - Caching with `resetConfig()` for tests, `getConfig()` for access
  - Reads PORT, RATE_LIMIT_MAX, LOG_LEVEL, DB_POOL_MAX, CACHE_TTL from env — 17 tests

### Testing

- [ ] **Setup Playwright for E2E tests**
  - Install `@playwright/test`, create config file

- [ ] **Create test database setup**
  - Setup test database separate from dev

- [x] **Create test fixtures/factories**
  - Files: `packages/core/src/testing/factories.js`
  - `createTestUser()`, `createTestPost()`, `createTestSession()` with overridable defaults
  - Import via `@techstream/quark-core/testing` subpath — 62 tests for all testing utilities

- [ ] **Add API integration tests**
  - Test all CRUD endpoints with valid/invalid data

- [ ] **Add unit tests for validators**
  - Test Zod schemas with edge cases

### Authorization

- [x] **Add role-based access control (RBAC)**
  - Added `role` field to User model in Prisma schema (default: "viewer")
  - Policy-based RBAC engine in `packages/core/src/authorization.js`
  - `createAuthorization(policy)`, `can()`, `authorize()`, `hasPermission()` — 36 tests
  - Default policy: admin (wildcard), editor (posts CRUD, users read), viewer (read-only)

- [x] **Create permission middleware**
  - `requireRole(...roles)` validates session user role
  - `withAuthorization({ action, resource, getContext })` wraps route handlers
  - Ownership checks via `ownerId` context for resource-level authorization

- [x] **Update API routes with authorization**
  - Auth callbacks inject `role` into JWT token and session
  - `extendPolicy()` allows downstream apps to add custom roles/permissions

---

## PRIORITY 3: MEDIUM (Important for Complete App)

### API Features

- [ ] **Add pagination utilities**
  - Files: `packages/core/src/pagination.js` (create)
  - Support offset/limit and cursor-based pagination

- [x] **Add search/filtering**
  - Implement query builders for filtering by fields, sorting

- [x] **Add sorting support**
  - Allow sorting by any field (asc/desc)

- [x] **Add request/response logging**
  - Log all API payloads for debugging

### File Handling

- [x] **Setup file upload endpoint**
  - Files: `apps/web/src/app/api/files/route.js`, `apps/web/src/app/api/files/[id]/route.js`
  - POST multipart upload with auth, GET list with pagination, GET download, DELETE with ownership check

- [x] **Add multipart form parsing**
  - Files: `packages/core/src/multipart.js`
  - Streaming parser using `busboy`, supports max file size / count limits

- [x] **Implement file validation**
  - Files: `packages/core/src/file-validation.js`
  - Magic-byte detection, MIME allow-list with wildcards, size limits, spoofing prevention

- [x] **Setup file storage**
  - Files: `packages/core/src/storage.js`
  - Adapter-based: local filesystem + S3-compatible (AWS S3, Cloudflare R2, MinIO)
  - Factory via `createStorage()`, reads `STORAGE_PROVIDER` env var
  - Prisma `File` model in schema with queries in `packages/db/src/queries.js`

- [x] **Add file cleanup**
  - Files: `apps/worker/src/handlers/files.js`, `packages/jobs/src/definitions.js`
  - BullMQ repeating job (24h) deletes orphaned files from storage + DB

### Documentation

- [x] **Add API documentation (OpenAPI/Swagger)**
  - Files: `docs/openapi.yaml`
  - OpenAPI 3.1 spec covering all 9 route groups (auth, users, posts, files, health, metrics, csrf)
  - Complete request/response schemas, auth requirements, CSRF token handling
  - Reusable components: Error, SuccessResponse, User, Post, File, HealthResponse schemas
  - Prometheus metrics endpoint documented

- [ ] **Create architecture decision records (ADRs)**
  - Files: `docs/adr/` (create)
  - Document why certain choices were made

- [x] **Document database schema**
  - Files: `docs/DATABASE.md`
  - All 8 models documented: User, Post, Account, Session, VerificationToken, Job, File, AuditLog
  - Column types, constraints, indexes, relations, cascade behavior
  - Migration history, query helper reference, best practices for extending schema
  - Index strategy guide

- [ ] **Add troubleshooting guide**
  - Files: `docs/TROUBLESHOOTING.md` (create)
  - Common issues and solutions

### CLI Tool

- [x] **Implement project scaffolding logic**
  - Files: `packages/cli/src/index.js`
  - Generate new project files from templates

- [x] **Create template files**
  - Files: `packages/cli/templates/`
  - Store project templates

- [x] **Add post-install scripts**
  - Install dependencies, generate Prisma client

- [x] **Test CLI end-to-end**
  - Create new project from CLI and verify it works

### UI & Design System

- [x] **Implement full component library**
  - Files: `packages/ui/src/`
  - 11 components: Badge, Button, Card, Checkbox, Dialog, Input, Label, Select, Skeleton, Table, Textarea
  - All use `React.createElement` (no JSX in packages), accept `className`, Server Component safe
  - Client-only: Dialog, Toast/useToast, ThemeProvider/useTheme

- [x] **Add dark mode support (Tailwind `@custom-variant dark`)**
  - `globals.css`: `@custom-variant dark (&:is([data-theme="dark"] *))` — data-theme attribute strategy
  - Dark-first CSS custom properties with light overrides via `@media` + `[data-theme="light"]`
  - FOUC prevention: blocking script in `layout.js` reads localStorage + OS pref before first paint
  - All 11 UI components updated with `dark:` utility class variants
  - CSS variables: `--quark-page-bg`, `--quark-text-primary`, `--quark-border`, `--quark-input-bg`, etc.

- [x] **Implement ThemeProvider and theme toggle**
  - Files: `packages/ui/src/theme.js`, `packages/ui/src/theme-constants.js`
  - `ThemeProvider` React context + `useTheme()` hook for reading/setting theme
  - `THEME_ATTR`, `THEME_STORAGE_KEY`, `THEME_CHANGE_EVENT` constants for DOM-level sync
  - `HomeThemeToggle` in `apps/web` + `AdminThemeToggle` in admin sidebar

- [x] **Add QuarkLogo component**
  - Files: `packages/ui/src/logo.js`
  - Pure Server Component inline SVG with dark-mode aware arc (`var(--quark-logo-dark-arc)`)
  - CSS variable `--quark-logo-dark-arc` switches to visible desaturated blue-gray in dark mode

### Admin UI

- [x] **Implement auto-generated admin UI**
  - Files: `apps/web/src/app/admin/`
  - Powered by `@techstream/quark-admin` — Prisma DMMF introspection, no code generation
  - Full CRUD: list, create, edit, delete for every Prisma model
  - Routes: `/admin`, `/admin/[model]`, `/admin/[model]/new`, `/admin/[model]/[id]`
  - `ModelTable.js` — generic record list using `<Table>` from `@techstream/quark-ui`
  - `ModelForm.js` — generic create/edit form with proper `variant="danger"` delete button
  - `FieldRenderer.js` — maps Prisma field types to appropriate form inputs
  - `Sidebar.js` — collapsible model navigation
  - Admin is opt-in at scaffolding time (`--features admin`)

- [x] **Enforce admin RBAC**
  - Admin `layout.js` requires authenticated session with `role: "admin"`
  - Unauthorized users redirected to sign-in page
  - Integrates with existing authorization middleware from `@techstream/quark-core`

---

## PRIORITY 4: LOW (Polish & Nice-to-Have)

### Deployment & DevOps

- [ ] **Setup GitHub Actions CI/CD**
  - Files: `.github/workflows/ci.yml` (create)
  - Run lint, test, build on every push

- [ ] **Create deployment workflow**
  - Use `quark deploy railway` CLI (see `packages/cli/src/deploy/`)
  - Or: `.github/workflows/deploy.yml` for CI-based deployment

- [ ] **Add Docker image configuration**
  - Files: `Dockerfile` (create)
  - Build and run app in containers

- [ ] **Create production compose file**
  - Files: `docker-compose.prod.yml` (create)
  - Production-ready services

- [ ] **Setup secrets management**
  - Configure GitHub Secrets for sensitive environment variables

- [ ] **Add database backup strategy**
  - Document backup frequency and restore process

### Monitoring & Analytics

- [ ] **Add APM (Application Performance Monitoring)**
  - Setup New Relic, DataDog, or similar

- [ ] **Add error rate monitoring**
  - Alert on high error rates

- [ ] **Add slow query logging**
  - Identify and optimize slow database queries

- [ ] **Add user analytics**
  - Track user behavior (page views, actions)

- [ ] **Add performance budgets**
  - Set targets for page load time, bundle size

### Advanced Features

- [ ] **Add full-text search**
  - Implement Elasticsearch or Meilisearch integration

- [ ] **Add WebSocket support**
  - For real-time features (if needed)

- [ ] **Add GraphQL API**
  - Alternative to REST (optional)

- [ ] **Add API versioning**
  - Support multiple API versions

- [ ] **Add webhook system**
  - Allow external services to subscribe to events

### Developer Experience

- [ ] **Add pre-commit hooks**
  - Use Husky to run lint/test before commits

- [ ] **Add commit message linting**
  - Enforce conventional commits with commitlint

- [ ] **Add code generation tools**
  - Scripts to generate boilerplate code

- [ ] **Add local development script**
  - One-command setup (pnpm setup:local)

- [ ] **Add GitHub PR template**
  - Standard PR description format

- [ ] **Add contribution guidelines**
  - Files: `CONTRIBUTING.md` (create)

---

## QUICK REFERENCE: TASK COUNTS

| Priority | Count | Category |
|----------|-------|----------|
| **P1: Critical** | 23 | Infrastructure, DB, API, Validation, Auth, Jobs, Email |
| **P2: High** | 30 | Security (incl. hardening), Logging, Caching, Config, Testing, AuthZ |
| **P3: Medium** | 22 | API Features, Files, Docs, CLI |
| **P4: Low** | 20 | DevOps, Monitoring, Advanced, DX |
| **TOTAL** | **95** | |

---

## IMPLEMENTATION ROADMAP

### Phase 1: Core Functionality (P1 - Critical)
Focus on making the application functional and usable.

**Key Tasks:**
1. Sync lockfile and fix package configs
2. Implement API routes (User/Post CRUD)
3. Setup validation and error handling
4. Configure authentication
5. Implement background job processing
6. Setup email service

**Outcome:** Working application with full CRUD operations, auth, and email notifications

### Phase 2: Production Ready (P2 - High)
Focus on security, reliability, and observability.

**Key Tasks:**
1. Add security middleware (CORS, helmet, rate limiting)
2. Implement logging and monitoring
3. Setup database connection pooling and caching
4. Add authorization/RBAC
5. Create comprehensive test suite
6. Setup environment configuration validation

**Outcome:** Production-ready application with security, monitoring, and testing

### Phase 3: Completeness (P3 - Medium)
Focus on feature completeness and documentation.

**Key Tasks:**
1. Add advanced API features (pagination, search, filtering)
2. Implement file uploads
3. Create comprehensive documentation
4. Complete CLI tool implementation

**Outcome:** Feature-complete application with good documentation

### Phase 4: Polish (P4 - Low)
Focus on DevOps, advanced features, and developer experience.

**Key Tasks:**
1. Setup CI/CD pipeline
2. Add monitoring and analytics
3. Implement advanced features (search, real-time, etc.)
4. Improve developer experience

**Outcome:** Production-hardened application ready for scaling

---

## QUICK WINS (Start Here)

These tasks can be completed quickly and provide immediate value:

- [x] Sync lockfile (`pnpm install`)
- [x] Fix package.json main fields (2 files)
- [x] Exclude coverage from linting (Biome config)
- [x] Validate environment variables on startup
- [x] Add health check endpoint

**Estimated effort:** Less than 1 hour total

---

## NOTES

- **Don't block on:** Advanced features (P4) - focus on P1/P2 first
- **Parallel work:** P1 items can mostly be worked on independently
- **Dependencies:** Some P2 items depend on P1 (e.g., can't test routes before they exist)
- **Team size considerations:**
  - 1 person: P1 then P2 sequentially
  - 2+ people: Can parallelize P1 items
  - 3+ people: Can start P2 while P1 is being completed

---

## CLI Non-Interactive Mode

- [x] `--no-prompts` flag to skip all interactive prompts
- [x] `--features <list>` flag with validation (valid: `ui`, `jobs`)
- [x] `--skip-install` flag for CI/CD environments
- [x] `--skip-docker` flag to skip Docker cleanup step
- [x] Full lifecycle E2E test (`test:e2e:full`) — 7 phases, ~30s
- [x] Flag validation unit tests (`test:flags`) — 9 tests, 100% pass
- [x] GitHub Actions CI workflow (PR validation)
- [x] GitHub Actions nightly full lifecycle test
- [x] Documentation updated (README, ARCHITECTURE, EXAMPLES)

---

## STATUS TRACKING

Use this section to track which items have been completed:

```
P1 Complete:   23/23 (100%) ✅
P2 Complete:   30/30 (100%) ✅
P3 Complete:   5/22 (23%)
P4 Complete:   0/20 (0%)
Total:         58/95 (61%)
```

**Recent Updates:**
- 2026-02-16: Completed application metrics, environment configs, config loader, OpenAPI docs, database docs
- 2026-02-17: Security hardening — fixed path traversal, IP spoofing, missing CSRF, weak secret validation
- 2026-02-17: Added search/filtering, sorting, and request/response logging support

Last Updated: 17 February 2026
