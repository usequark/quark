# Quark Security Guide

This document outlines the security features, best practices, and recommendations for Quark applications.

---

## Security Features

### ✅ Built-in Security

Quark includes several security features out of the box:

#### 1. **Rate Limiting**
- **Location**: [apps/web/src/proxy.js](../apps/web/src/proxy.js)
- **Protection**: Prevents brute force attacks and API abuse
- **Configuration**:
  - General API endpoints: 100 requests per 15 minutes
  - Auth endpoints: 5 requests per 15 minutes
- **Headers**: Returns `X-RateLimit-*` headers for client feedback
- **Storage**: Redis-backed when `REDIS_URL` is set (shared budget across instances), in-memory when it is unset (single instance). `apps/web/src/proxy.js` reads `REDIS_URL` and builds the limiter from the core building block (`createRateLimiter({ type: "redis", redisClient })` in `packages/core/src/rate-limiter.js`), failing closed by default. See [Redis-based Rate Limiting](#3-redis-based-rate-limiting-) below.

#### 2. **Security Headers**
- **Location**: [apps/web/src/proxy.js](../apps/web/src/proxy.js), [apps/web/next.config.js](../apps/web/next.config.js)
- **Headers Applied** (in both `proxy.js` and `next.config.js` `headers()`, which acts as the fallback for routes the proxy does not match):
  - `X-Frame-Options: SAMEORIGIN` - Prevent clickjacking
  - `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` - Restrict browser features
  - `X-DNS-Prefetch-Control: on` - Performance optimization
  - `Content-Security-Policy` - Built by `apps/web/src/lib/analytics/umami-csp.js`; Turbopack's `unsafe-eval` is added only outside production
  - `Strict-Transport-Security` - **`proxy.js` only**: `next.config.js` `headers()` omits it, so a route the proxy does not match (its matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and image files) gets no HSTS from config

  `X-XSS-Protection` is not set; the CSP directive above is what ships.

#### 3. **CORS Configuration**
- **Location**: [apps/web/src/proxy.js](../apps/web/src/proxy.js)
- **Environment-based**: origins derive from `APP_URL`; `ALLOWED_ORIGINS` (comma-separated, production) and `NEXT_DEV_ALLOWED_ORIGINS` / `ALLOWED_DEV_ORIGINS` (development hosts) add extras. Resolved in `packages/config/src/app-url.js`
- **Default**: `APP_URL` + `http://localhost:3000,http://localhost:3001` in development
- **Credentials**: Enabled by default for authenticated requests
- **Preflight**: Handles OPTIONS requests automatically

#### 4. **Password Security**
- **Algorithm**: bcrypt with 12 rounds
- **Location**: [packages/core/src/auth/password.js](../packages/core/src/auth/password.js)
- **Functions**: `hashPassword()`, `verifyPassword()`
- **Recommendation**: Never store plain text passwords

#### 5. **Input Validation**
- **Library**: Zod
- **Location**: [packages/db/src/schemas.js](../packages/db/src/schemas.js)
- **Validation**: All API inputs validated against schemas
- **Error Handling**: Returns structured validation errors

#### 6. **SQL Injection Protection**
- **ORM**: Prisma (all queries parameterized)
- **Risk**: LOW - No raw SQL interpolating user input. The only raw statements are the constant `prisma.$queryRaw\`SELECT 1\`` health probes in `apps/worker/src/index.js`
- **Recommendation**: Continue using Prisma for all database operations

#### 7. **Session Management**
- **Library**: NextAuth.js (Auth.js v5)
- **Strategy**: JWT — a constraint, not a preference: the scaffold always ships a credentials provider, and Auth.js throws `UnsupportedStrategy` when `strategy: "database"` is set and every provider is credentials
- **Max Age**: 30 days
- **Revocation**: the `jwt` callback re-validates the token against the database on every request (`apps/web/src/lib/auth.js`). A deleted user's token is rejected and the cookie cleared; the role is refreshed from the row, so demoting an admin takes effect immediately; and any token issued before `User.passwordChangedAt` is rejected, so changing a password kills every session the old password created. An unreachable database fails closed (session rejected), never open.
- **Secret**: Environment-based `NEXTAUTH_SECRET`

#### 8. **Email Verification Gate**
- **Flag**: `REQUIRE_EMAIL_VERIFICATION` — **default `true`**. Set to `false` to restore the pre-gate behaviour on every path at once.
- **Validated**: declared in [packages/config/src/validate-env.js](../packages/config/src/validate-env.js) with the same Zod `booleanLike` schema as `AUTH_ALLOW_SIGNUP`, and surfaced as `config.auth.requireEmailVerification` (defaulted per environment in [packages/config/src/environment.js](../packages/config/src/environment.js)). Accepted spellings: `true/false`, `1/0`, `yes/no`, `on/off`.
- **Governs two paths, from one source** ([apps/web/src/lib/auth-email-verification.js](../apps/web/src/lib/auth-email-verification.js)):
  - **Credentials** — the `authorize()` in [apps/web/src/lib/auth.js](../apps/web/src/lib/auth.js) checks `User.emailVerified` after the password verifies and throws an `AppError` with code `OAUTH_EMAIL_NOT_VERIFIED` (401) when it is unset or null. It throws rather than returning `null` so the reason survives to the operator's log instead of collapsing into Auth.js's generic "Invalid credentials".
  - **OAuth** — the Google provider's `profile()` mapper applies the same rule to the provider's `email_verified` claim, and `POST /api/auth/google` (the mobile route) applies it to the `tokeninfo` response. With the flag off, all three fall back to their prior behaviour.
- **`null` reads as unverified.** `User.emailVerified` is a nullable column with no default, so a row that has never been through `/api/auth/verify-email` is unverified — whether it was created by registration, by the seed, or by OAuth.
- **Password is checked first.** The verification refusal only fires once the password matches; the other order would answer "is this address registered and confirmed" for anyone who can submit a name, using the error code as the oracle.

**Migration note:** turning this on (it is on by default) refuses sign-in for **every existing credentials user whose `emailVerified` is null** — in practice, all users who signed up before the verification link existed and never clicked one. Registration has never set `emailVerified`, so this is not limited to old rows. On upgrade, either confirm your existing user base before deploying, tell users to request a fresh link, or ship with `REQUIRE_EMAIL_VERIFICATION=false` and flip it once the backlog is verified. A SQL backfill that stamps `emailVerified = now()` for known-good addresses is the other option; it is a judgement call only you can make, because it asserts something about an address you did not observe being confirmed.

---

## Environment Variable Security

### Critical Secrets

The following environment variables contain sensitive data and must be kept secure:

#### **NEXTAUTH_SECRET**
- **Purpose**: Encrypts JWT tokens and session data
- **Generation**: `openssl rand -base64 32`
- **Auto-generated**: Yes (by CLI during project creation)
- **Rotation**: Required when suspected compromise
- **Storage**: Never commit to version control

#### **Database Passwords**
- **Variables**: `POSTGRES_PASSWORD`
- **Default**: Auto-generated 24-character random string (CLI)
- **Production**: Rotate regularly, use secret management service
- **Strength**: Minimum 16 characters, mixed case, numbers, symbols

#### **OAuth Secrets**
- **Variables**: `GITHUB_SECRET`, `GOOGLE_CLIENT_SECRET`
- **Source**: Provider developer consoles
- **Storage**: Environment variables only
- **Rotation**: Follow provider recommendations

### Environment File Security

```bash
# ✅ DO: Keep .env files local and gitignored
.env
.env.local
.env.production

# ✅ DO: Use .env.example as template (no secrets)
.env.example

# ❌ DON'T: Commit .env files to git
# ❌ DON'T: Share .env files via chat/email
# ❌ DON'T: Use production secrets in development
```

---

## Security Checklist

### Development Environment

- [x] ✅ `.env` files are gitignored
- [x] ✅ Auto-generated secrets on project creation
- [x] ✅ Database passwords are unique per project
- [x] ✅ NEXTAUTH_SECRET is random and secure
- [ ] ⚠️ Local database is not exposed to internet

### Production Deployment

- [ ] ⚠️ All secrets rotated from development defaults
- [ ] ⚠️ APP_URL set to production domain (HTTPS)
- [ ] ⚠️ Database uses strong password (not default)
- [ ] ⚠️ Rate limiting migrated to Redis (multi-instance)
- [ ] ⚠️ ALLOWED_ORIGINS configured if additional origins needed
- [ ] ⚠️ SSL/TLS certificates configured
- [ ] ⚠️ Database connection uses SSL
- [ ] ⚠️ Redis connection secured (password/ACL)
- [ ] ⚠️ Environment variables stored in secure vault
- [ ] ⚠️ Secrets not logged or exposed in error messages
- [ ] ⚠️ Dependency vulnerability scanning enabled
- [ ] ⚠️ Error tracking configured (Sentry, etc.)
- [ ] ⚠️ Logging configured (no sensitive data logged)
- [ ] ⚠️ `REQUIRE_EMAIL_VERIFICATION` reviewed against the installed base — default `true` refuses sign-in for any account with no confirmation on file

---

## Remaining Security Tasks

### High Priority

All high-priority security tasks have been completed! ✅

1. **CSRF Protection** ✅
   - Status: ✅ Implemented
   - Location: [packages/core/src/csrf.js](../packages/core/src/csrf.js)
   - API Endpoint: `/api/csrf` to get tokens
   - Usage: Include `X-CSRF-Token` header in state-changing requests
   - Note: NextAuth automatically handles CSRF for `/api/auth/*` routes

2. **Request Size Limits** ✅
   - Status: ✅ Configured
   - Location: [proxy.js](../apps/web/src/proxy.js), [next.config.js](../apps/web/next.config.js)
   - Default API: 2MB (env: `API_BODY_SIZE_LIMIT`)
   - Upload request body: 10MB (env: `UPLOAD_SIZE_LIMIT`, read by `apps/web/src/proxy.js`)
   - Per-file cap: 10MB (env: `UPLOAD_MAX_SIZE`, read by `packages/core/src/file-validation.js`). Separate knob from the request-body limit; both default to 10MB
   - Response: 413 Payload Too Large when exceeded

3. **Redis-based Rate Limiting** ✅
   - Status: ✅ Wired into the shipped middleware; fails closed on Redis errors
   - Location: [packages/core/src/rate-limiter.js](../packages/core/src/rate-limiter.js), consumed by [apps/web/src/proxy.js](../apps/web/src/proxy.js)
   - `apps/web/src/proxy.js` reads `REDIS_URL`: set it and the limiter is Redis-backed (shared budget across instances); leave it unset and it uses in-memory counters (single instance)
   - Fail-closed: a Redis error mid-request returns "limited" (429), not "allowed". A limiter that allows traffic through the moment it is unreachable is no limiter during the flood that knocked Redis over. Opt back into the old permissive behavior with `createRateLimiter({ type: "redis", failOpen: true })` if outage-driven 429s are the bigger risk for you
   - Losing Redis degrades to in-memory counters rather than dropping rate limiting entirely; the trade is that the budget is then per-instance, not global

### Medium Priority

4. **Content Security Policy (CSP)**
   - Status: ⚠️ Basic headers only
   - Risk: LOW
   - Recommendation: Configure strict CSP for production
   - Complexity: HIGH (requires testing with all assets)

5. **Dependency Scanning**
   - Status: ✅ Configured via Dependabot
   - Config: `.github/dependabot.yml` for this monorepo. Scaffolded projects get their own copy at `.github/dependabot.yml` plus `.github/workflows/dependabot-auto-merge.yml`
   - Triage record: [`docs/dependency-audit.md`](./dependency-audit.md)
   - Note: the `pnpm-lock.yaml` overrides in `pnpm-workspace.yaml` are audited there and must stay in sync

6. **Secrets Scanning**
   - Status: ❌ Not configured
   - Risk: LOW (prevention)
   - Recommendation: Add git hooks to prevent secret commits
   - Tools: git-secrets, truffleHog

---

## Security Incident Response

### If Secrets are Compromised

1. **Immediate Actions**:
   - Rotate all affected secrets immediately
   - Revoke compromised OAuth tokens/PATs
   - Check logs for unauthorized access
   - Update `.env` files on all environments

2. **NEXTAUTH_SECRET Rotation**:
   ```bash
   # Generate new secret
   openssl rand -base64 32
   
   # Update .env
   NEXTAUTH_SECRET=<new_value>
   
   # Restart application
   # All users will be logged out (expected)
   ```

3. **Database Password Rotation**:
   ```bash
   # 1. Generate new password
   # 2. Update database user password
   # 3. Update .env with new password
   # 4. Restart all services
   ```

### Reporting Security Issues

If you discover a security vulnerability, follow the disclosure process in the
repository's [SECURITY.md](../SECURITY.md). Do not open a public issue.

---

## Production Deployment Security

### Redis Rate Limiting Setup

`REDIS_URL` now does double duty: it feeds the worker's BullMQ connections **and**
selects the web middleware's rate-limit backend. Set it and `apps/web/src/proxy.js`
builds a shared Redis-backed limiter; leave it unset and the limiter is in-memory,
which is correct for a single-instance deployment.

```bash
# Set in production .env - consumed by the worker/BullMQ and the web rate limiter
REDIS_URL=redis://your-redis-host:6379
# or for Redis with password
REDIS_URL=redis://:password@your-redis-host:6379
```

No code changes are required. If you need the web layer to talk to Redis through a
custom client (TLS, a sentinel topology, an in-process mock), build it and pass it
to `createRateLimiter` directly:

```javascript
import { createRateLimiter } from "@usequark/quark-core/core";
import { resolveRedisConnection } from "@usequark/quark-core/redis";
import { Redis } from "ioredis";

const limiter = createRateLimiter({
  type: "redis",
  redisClient: new Redis(resolveRedisConnection()),
});
```

**Testing Redis Rate Limiting**:
```bash
# Start Redis locally
docker run -d -p 6379:6379 redis:7-alpine

# Set environment variable (now also switches the web middleware's limiter)
export REDIS_URL=redis://localhost:6379

# Restart your application
pnpm dev
```

With `REDIS_URL` set, repeated hits to an API route are counted in Redis rather than
in the process, so two instances of the app share one budget.

### CSRF Token Implementation

#### Server-Side Setup

CSRF tokens are automatically available via the `/api/csrf` endpoint.

The endpoint mints a token, sets it as an `httpOnly` `SameSite=Strict` cookie, and returns the same value in the body. It does **not** require a session — registration is pre-authentication, so a visitor with no account has to be able to obtain a token before they can register. Because the token in the body is a write credential, every response carries `Cache-Control: no-store` and `Vary: Cookie`.

Wrap each mutating route in `withCsrfProtection`; it compares the `x-csrf-token` header against the cookie and rejects the request before your handler runs.

#### Client-Side Integration

Use the bundled helper rather than rolling your own. It fetches the token, caches it, dedupes concurrent callers, and refetches before the cookie's one-hour lifetime runs out:

```javascript
// components/CreatePost.js
"use client";
import { getCsrfToken } from '@usequark/quark-core/csrf-client';

export function CreatePost() {
  const handleSubmit = async (data) => {
    const csrfToken = await getCsrfToken();

    await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify(data)
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

Import from `@usequark/quark-core/csrf-client`, not the package root. The root barrel re-exports the server-side `csrf.js`, which imports `node:crypto`; reaching the helper through it pulls a Node builtin into the browser bundle and fails the build.

If you keep your own cache, match the cookie's lifetime. A cached token that outlives the one-hour cookie produces `Invalid CSRF token`, which reads like a header bug rather than staleness. `clearCsrfToken()` is exported for the other case — the server rotating the cookie underneath the client, e.g. after sign-out.

**API client wrapper**:
```javascript
// lib/api-client.js
import { getCsrfToken } from '@usequark/quark-core/csrf-client';

export async function apiPost(url, data) {
  const token = await getCsrfToken();
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token
    },
    body: JSON.stringify(data)
  });
}
```

### Environment Configuration

```bash
# Production .env template
NODE_ENV=production

# Database (use managed service credentials)
POSTGRES_HOST=<managed-db-host>
POSTGRES_PASSWORD=<strong-password-from-secret-manager>
DATABASE_URL=<connection-string-with-ssl>

# Redis (use managed service)
# Consumed by the worker/BullMQ connections and by the web middleware's
# rate limiter - setting it makes the limiter Redis-backed (shared budget
# across instances). Leave it unset for in-memory, per-instance counters.
REDIS_URL=<redis-connection-string-with-password>

# Application URL (derives NEXTAUTH_URL and CORS origins)
APP_URL=https://yourdomain.com

# NextAuth
NEXTAUTH_SECRET=<strong-secret-from-vault>

# Email verification gate (default: true - uncomment only to opt out)
# Governs both the credentials sign-in check and the OAuth email_verified
# check. Setting it to false restores the behaviour from before the gate.
# REQUIRE_EMAIL_VERIFICATION=false

# OAuth (optional - from provider consoles)
# Each provider is enabled by its client id alone. Google also needs the secret
# for the NextAuth sign-in button; the mobile routes need only the client id.
# GITHUB_ID=<production-oauth-id>
# GITHUB_SECRET=<production-oauth-secret>
# GOOGLE_CLIENT_ID=<production-google-client-id>
# GOOGLE_CLIENT_SECRET=<production-google-secret>
# APPLE_CLIENT_ID=com.example.yourapp

# Additional CORS origins (optional - APP_URL is always included)
# ALLOWED_ORIGINS=https://admin.yourdomain.com,https://app.yourdomain.com

# Monitoring
SENTRY_DSN=<sentry-dsn>
```

### Recommended Security Services

- **Secrets Management**: AWS Secrets Manager, HashiCorp Vault, Doppler
- **Vulnerability Scanning**: Snyk, Dependabot, GitHub Security
- **Error Tracking**: Sentry, Rollbar, Bugsnag
- **DDoS Protection**: Cloudflare, AWS Shield
- **WAF**: Cloudflare WAF, AWS WAF

---

## Security Best Practices

### For Developers

1. ✅ Never commit secrets to git
2. ✅ Use environment variables for all secrets
3. ✅ Validate all user inputs
4. ✅ Use Prisma for all database queries (no raw SQL)
5. ✅ Hash passwords before storing
6. ✅ Keep dependencies updated
7. ✅ Review security headers periodically
8. ✅ Test authentication flows thoroughly
9. ✅ Log security events (failed logins, rate limits)
10. ✅ Implement proper error handling (no stack traces to users)

### For DevOps

1. ✅ Rotate secrets regularly (90 days minimum)
2. ✅ Use HTTPS everywhere in production
3. ✅ Configure database SSL/TLS
4. ✅ Enable Redis authentication
5. ✅ Set up monitoring and alerts
6. ✅ Regular security audits
7. ✅ Backup strategy with encryption
8. ✅ Principle of least privilege (IAM, database roles)
9. ✅ Network segmentation
10. ✅ DDoS protection

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NextAuth.js Security](https://next-auth.js.org/configuration/options#security)
- [Prisma Security](https://www.prisma.io/docs/guides/performance-and-optimization/query-optimization-performance)
- [bcrypt Best Practices](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

Last Updated: 15 October 2026
