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
- **Storage**: in-memory by default, Redis-backed when `REDIS_URL` is set. For multi-instance deployments `REDIS_URL` is required, otherwise each instance counts independently. See [Redis-based Rate Limiting](#3-redis-based-rate-limiting-) below.

#### 2. **Security Headers**
- **Location**: [apps/web/src/proxy.js](../apps/web/src/proxy.js), [apps/web/next.config.js](../apps/web/next.config.js)
- **Headers Applied**:
  - `X-Frame-Options: SAMEORIGIN` - Prevent clickjacking
  - `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
  - `X-XSS-Protection: 1; mode=block` - Enable XSS filter
  - `Strict-Transport-Security` - Force HTTPS (production)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` - Restrict browser features
  - `X-DNS-Prefetch-Control: on` - Performance optimization

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
- **Risk**: LOW - No raw SQL queries in codebase
- **Recommendation**: Continue using Prisma for all database operations

#### 7. **Session Management**
- **Library**: NextAuth.js
- **Strategy**: JWT (configurable to database sessions)
- **Max Age**: 30 days
- **Update Age**: 24 hours (session refresh)
- **Secret**: Environment-based `NEXTAUTH_SECRET`

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
   - Status: ✅ Implemented with fallback
   - Location: [packages/core/src/rate-limiter.js](../packages/core/src/rate-limiter.js)
   - In-memory: Default for single-instance deployments
   - Redis: Set `REDIS_URL` to enable (recommended for production)
   - Alternative: Use [proxy.redis.js](../apps/web/src/proxy.redis.js)

### Medium Priority

4. **Content Security Policy (CSP)**
   - Status: ⚠️ Basic headers only
   - Risk: LOW
   - Recommendation: Configure strict CSP for production
   - Complexity: HIGH (requires testing with all assets)

5. **Dependency Scanning**
   - Status: ✅ Configured via Dependabot
   - Config: `.github/dependabot.yml` for this monorepo. Scaffolded projects get their own copy at `.github/dependabot.yml` plus `.github/dependabot-auto-merge.yml`
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

For production deployments with multiple instances, enable Redis-based rate limiting:

**Option 1: Environment Variable (Automatic)**
```bash
# Set in production .env
REDIS_URL=redis://your-redis-host:6379
# or for Redis with password
REDIS_URL=redis://:password@your-redis-host:6379
```

The middleware will automatically detect `REDIS_URL` and use Redis for rate limiting.

**Option 2: Explicit Redis Middleware**
```bash
# Install ioredis
pnpm add ioredis

# Replace proxy.js with proxy.redis.js
mv apps/web/src/proxy.redis.js apps/web/src/proxy.js
```

**Testing Redis Rate Limiting**:
```bash
# Start Redis locally
docker run -d -p 6379:6379 redis:7-alpine

# Set environment variable
export REDIS_URL=redis://localhost:6379

# Restart your application
pnpm dev
```

### CSRF Token Implementation

#### Server-Side Setup

CSRF tokens are automatically available via the `/api/csrf` endpoint.

#### Client-Side Integration

**React/Next.js Example**:
```javascript
// hooks/useCsrfToken.js
import { useEffect, useState } from 'react';

export function useCsrfToken() {
  const [token, setToken] = useState(null);
  
  useEffect(() => {
    fetch('/api/csrf')
      .then(res => res.json())
      .then(data => setToken(data.csrfToken));
  }, []);
  
  return token;
}

// Usage in component
function CreatePost() {
  const csrfToken = useCsrfToken();
  
  const handleSubmit = async (data) => {
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

**Alternative: API Route Helper**:
```javascript
// lib/api-client.js
let csrfToken = null;

async function getCsrfToken() {
  if (!csrfToken) {
    const res = await fetch('/api/csrf');
    const data = await res.json();
    csrfToken = data.csrfToken;
  }
  return csrfToken;
}

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
REDIS_URL=<redis-connection-string-with-password>

# Application URL (derives NEXTAUTH_URL and CORS origins)
APP_URL=https://yourdomain.com

# NextAuth
NEXTAUTH_SECRET=<strong-secret-from-vault>

# OAuth (from provider consoles)
GITHUB_ID=<production-oauth-id>
GITHUB_SECRET=<production-oauth-secret>

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

Last Updated: 13 February 2026
