# Pre-Production Fix Plan

> Generated from the production-readiness review on 2026-02-14.
> Ordered by severity and dependency. Each phase can be a single PR.

---

## Phase 1 — Critical Security (blocks deployment) ✅ COMPLETE

> Completed 2026-02-14. All 10 turbo tasks pass (build + tests).

### 1.1 Strip `password` from all user query responses ✅
Added `USER_SAFE_SELECT` constant in `packages/db/src/queries.js`. Applied to `findById`, `findAll`, `create`, `update`. `findByEmail` left unrestricted for auth.

### 1.2 Add `role` to Credentials `authorize` return ✅
Added `role: existingUser.role` in both `apps/web/src/lib/auth.js` and `packages/cli/templates/base-project/apps/web/src/lib/auth.js`.

### 1.3 Enforce CSRF protection on state-changing routes ✅
Wrapped all POST/PATCH/DELETE handlers with `withCsrfProtection` in:
- `apps/web/src/app/api/users/route.js` (POST)
- `apps/web/src/app/api/users/[id]/route.js` (PATCH, DELETE)
- `apps/web/src/app/api/posts/route.js` (POST)
- `apps/web/src/app/api/posts/[id]/route.js` (PATCH, DELETE)
- Register endpoint exempt (pre-auth).

---

## Phase 2 — High Severity (must fix before production) ✅ COMPLETE

> Completed 2026-02-14. All 10 turbo tasks pass. Core tests: 224 pass / 0 fail.

### 2.1 Strengthen password policy ✅
Added uppercase, lowercase, and digit regex checks to `userRegisterSchema` in `packages/db/src/schemas.js`.

### 2.2 Remove hardcoded DB password fallback ✅
`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` now throw if missing — no silent fallbacks.
Applied to both `packages/db/src/client.js` and `packages/cli/templates/base-project/packages/db/src/client.js`.

### 2.3 Throw on missing `NEXTAUTH_SECRET` in all environments ✅
Removed `NODE_ENV === "production"` guard in `packages/core/src/auth/index.js`. Always throws if secret is falsy.
Updated `auth.test.js` to pass a secret and added a dedicated "throws when missing" test.

### 2.4 Replace `console.*` with structured logger ✅
Replaced all `console.log`/`console.error` with `createLogger` in:
- `apps/web/src/app/api/error-handler.js` (logger: "api")
- `apps/web/src/app/api/health/route.js` (logger: "health") — also sanitized error message to "Service health check failed"
- `apps/worker/src/index.js` (logger: "worker") — all 10 console calls replaced + added `prisma.$disconnect()` in shutdown

### 2.5 Sync template worker with real implementation ✅
Replaced 4-line stub in `packages/cli/templates/base-project/apps/worker/src/index.js` with full worker implementation using structured logger.

### 2.6 Add email service tests ✅
Created `packages/core/src/email.test.js` with 9 tests covering:
- Service creation and method shape
- SMTP provider defaults (Mailhog) and explicit config
- Resend provider: fetch calls, headers, body validation
- Error handling: missing API key, non-ok responses, non-JSON errors
- Options override (custom `from` address)

---

## Phase 3 — Medium Severity (production quality) ✅ COMPLETE

> Completed 2026-02-15. All 10 turbo tasks pass. Core tests: 227 pass / 0 fail.

### 3.1 Add `Content-Security-Policy` header ✅
Replaced deprecated `X-XSS-Protection` with CSP in:
- `apps/web/src/proxy.js` — Added to `SECURITY_HEADERS` object.
- `apps/web/next.config.js` — Added to fallback `headers()` array.
- `packages/cli/templates/base-project/apps/web/src/middleware.js` — Template mirror.

CSP value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';`

### 3.2 Validate pagination query params with Zod ✅
Added `paginationSchema` in `apps/web/src/app/api/posts/route.js` using `z.coerce.number()` for safe integer coercion with min/max/default. Added `zod` as a direct dependency of `apps/web`.

### 3.3 Sanitize health check error messages ✅
Already completed in Phase 2 (item 2.4) — health route uses structured logger and returns `"Service health check failed"`.

### 3.4 Add `createdAt`/`updatedAt` to Account model ✅
Added fields to Account model in both:
- `packages/db/prisma/schema.prisma`
- `packages/cli/templates/base-project/packages/db/prisma/schema.prisma`
- Created migration: `packages/db/prisma/migrations/20260215_add_account_timestamps/migration.sql`

### 3.5 Add email service input validation & timeout ✅
In `packages/core/src/email.js`:
- Added input validation for `to`, `subject`, `html` — throws on empty/missing.
- Added `connectionTimeout`, `greetingTimeout`, `socketTimeout` (all 10s) to SMTP configs.
- Added `AbortSignal.timeout(10_000)` to Resend fetch call.
- Added 3 tests in `email.test.js` for input validation (total: 12 email tests).

### 3.6 Add `prisma.$disconnect()` to worker shutdown ✅
Already completed in Phase 2 (item 2.4) — worker shutdown calls `prisma.$disconnect()`.

### 3.7 Fix template `client.js` import extension (`.js` → `.ts`) ✅
Fixed `packages/cli/templates/base-project/packages/db/src/client.js` to import from `./generated/prisma/client.ts` matching the main repo.

### 3.8 Remove dead Job queries ✅
Removed entire `job` export object (~93 lines) from both:
- `packages/db/src/queries.js`
- `packages/cli/templates/base-project/packages/db/src/queries.js`
Added comment explaining BullMQ handles job persistence in Redis. Verified no code imports `job` from quark-db.

---

## Phase 4 — Low Severity (polish) ✅ COMPLETE

> Completed 2026-02-15. All 10 turbo tasks pass. All 4 phases done.

### 4.1 Remove deprecated `X-XSS-Protection` header ✅ (completed in Phase 3, item 3.1)
Already removed from `proxy.js`, `next.config.js`, and template `middleware.js` when adding CSP.

### 4.2 Restrict `user.findById` to not include posts by default ✅
Split into `findById` (no posts) and `findByIdWithPosts` in both:
- `packages/db/src/queries.js` — uses `USER_SAFE_SELECT` without posts; added `findByIdWithPosts` with posts.
- `packages/cli/templates/base-project/packages/db/src/queries.js` — same split.
Also removed posts from `findAll` (same concern).

### 4.3 Add `@@index([expires])` to Session and VerificationToken ✅
Added `@@index([expires])` to both models in both:
- `packages/db/prisma/schema.prisma`
- `packages/cli/templates/base-project/packages/db/prisma/schema.prisma`
- Created migration: `packages/db/prisma/migrations/20260215_add_indexes/migration.sql`

### 4.4 Add compound `@@index([status, runAt])` to Job model ✅
Added `@@index([status, runAt])` to Job model in both schemas.
Included in the same migration as 4.3.

### 4.5 Improve seed script — add password to test user ✅
Updated `packages/db/scripts/seed.js` to hash `"Password1"` with bcrypt (12 rounds) and include it in the test user. Added `bcryptjs` as a devDependency of `@techstream/quark-db`. Template seed script updated to match.

---

## Dependency Graph

```
Phase 1 (no dependencies — all independent):
  1.1 ─┐
  1.2 ─┼── Can be done in parallel
  1.3 ─┘

Phase 2 (depends on Phase 1 being merged):
  2.1 ── depends on 1.1 (password policy applies to register route)
  2.2 ── independent
  2.3 ── independent
  2.4 ── independent (but do before 2.5 so template gets logger too)
  2.5 ── depends on 2.4 (template worker should use logger)
  2.6 ── independent

Phase 3 (depends on Phase 2):
  3.1-3.8 ── all independent of each other

Phase 4 (anytime):
  4.1-4.5 ── all independent
```

## Estimated Effort

| Phase | Items | Estimated Time |
|-------|-------|---------------|
| Phase 1 — Critical | 3 | ~1 hour |
| Phase 2 — High | 6 | ~3 hours |
| Phase 3 — Medium | 8 | ~3 hours |
| Phase 4 — Low | 5 | ~1 hour |
| **Total** | **22** | **~8 hours** |

---

Plan finalized. Ready for `expert-developer`.
