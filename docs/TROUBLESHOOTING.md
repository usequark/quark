# Troubleshooting Guide

Common issues and solutions when developing with or contributing to Quark.

---

## Table of Contents

1. [Docker / Local Services](#1-docker--local-services)
2. [Prisma & Database](#2-prisma--database)
3. [Authentication](#3-authentication)
4. [Environment Variables](#4-environment-variables)
5. [Rate Limiting](#5-rate-limiting)
6. [CORS](#6-cors)
7. [File Uploads](#7-file-uploads)
8. [Biome Lint Errors](#8-biome-lint-errors)
9. [Template Sync](#9-template-sync)
10. [Tests Failing](#10-tests-failing)

---

## 1. Docker / Local Services

### Postgres or Redis won't start

```bash
docker compose down -v   # Remove stopped containers and volumes
docker compose up -d     # Restart fresh
```

If port 5432 or 6379 is already in use by a local process:

```bash
lsof -i :5432   # Find what's using Postgres port
lsof -i :6379   # Find what's using Redis port
```

Kill the conflicting process or change the port mapping in `docker-compose.yml`.

### Mailpit not receiving emails

Ensure the `SMTP_HOST` in your `.env` points to `localhost` and `SMTP_PORT` is `1025`. Open http://localhost:8025 to view captured emails.

### Web container starts but is unreachable

If a Docker, Railway, or other container deployment boots but health checks fail or requests never connect, the standalone Next.js web server is probably bound to `localhost` inside the container.

Set:

```bash
HOSTNAME=0.0.0.0
```

Then use the standalone web entrypoint (`pnpm --dir apps/web start:deploy` in scaffolded apps) and let the platform inject `PORT` when possible. Quark's generated web Dockerfile and Railway config already set `HOSTNAME=0.0.0.0`; this usually only breaks when the start command or environment was customized.

---

## 2. Prisma & Database

### `PrismaClientInitializationError` on startup

The database URL is wrong or Postgres is not running.

1. Check `DATABASE_URL` in your `.env` matches `docker-compose.yml`
2. Run `docker compose ps` to confirm `postgres` is `Up`
3. Run `pnpm db:migrate` to ensure migrations are applied

### Schema changes not reflected in queries

After editing `prisma/schema.prisma`, always regenerate the client:

```bash
pnpm db:generate
```

If you added a new model, also run:

```bash
pnpm db:migrate
```

### `P2002` Unique constraint violation in tests

Tests that create database records may collide if they share email addresses or other unique fields. Use unique values per test run (e.g. `email: \`test-\${Date.now()}@example.com\``).

---

## 3. Authentication

### Redirected to `/login` on every request

The session cookie is missing or expired. Check:

1. `AUTH_SECRET` in `.env` is set (min 32 characters)
2. `NEXTAUTH_URL` matches the URL you're accessing the app from
3. Cookies are not being blocked by browser settings or a proxy

### OAuth sign-in returns `OAuthCallbackError`

1. Verify the provider's callback URL is set to `http://localhost:3000/api/auth/callback/<provider>`
2. Check that `AUTH_<PROVIDER>_ID` and `AUTH_<PROVIDER>_SECRET` are correct in `.env`

### CSRF errors on form submissions

All mutating requests (POST, PUT, PATCH, DELETE) must include the CSRF token. Use `withCsrfProtection` on API routes and ensure your forms call `getCsrfToken()` from `@usequark/quark-core`.

---

## 4. Environment Variables

### `MissingEnvError` on startup

A required environment variable is not set. The error message names the missing variable. Check your `.env` file against `.env.example`.

### Config validation fails with unexpected errors

The config package uses Zod for validation. If a variable exists but has the wrong format (e.g. `PORT=abc`), you'll see a Zod parse error. Check the type expectation in `packages/config/src/environment.js`.

---

## 5. Rate Limiting

### `429 Too Many Requests` during development

Rate limiting uses Redis. If you're hitting limits during dev, temporarily increase the limit in `packages/config/src/environment.js` or set `RATE_LIMIT_MAX` in your `.env`.

### Rate limiting not working after deploy

Ensure `REDIS_URL` is set in your production environment. Rate limiting silently no-ops when Redis is unavailable to avoid blocking legitimate requests, but this means limits are not enforced.

---

## 6. CORS

### Cross-origin requests blocked in development

CORS is enforced in `apps/web/src/proxy.js`, and the origin list is resolved in `packages/config/src/app-url.js`. The canonical origin comes from `APP_URL`; add extras with `ALLOWED_ORIGINS` (comma-separated, production) or `NEXT_DEV_ALLOWED_ORIGINS` / `ALLOWED_DEV_ORIGINS` (development hosts). For a local frontend on another port, add its origin rather than replacing the default.

### Preflight `OPTIONS` requests returning 405

All API routes that use `withCsrfProtection` handle `OPTIONS` automatically. If you have a custom route, add an explicit `OPTIONS` export or use the Quark `withCors` helper.

---

## 7. File Uploads

### `422 Unsupported Media Type` on file upload

The file type or size exceeds configured limits. Check `validateFile` defaults in `@usequark/quark-core`. Common causes:

- File exceeds `UPLOAD_MAX_SIZE` (default 10 MB, read by `packages/core/src/file-validation.js`). The request-body cap is a separate `UPLOAD_SIZE_LIMIT` in `apps/web/src/proxy.js`
- MIME type not in the allowlist

### Files not persisting between dev server restarts

The default local storage provider writes to `.quark-storage/` in the project root. This directory persists across restarts. If files are missing, check that the directory exists and was not deleted.

### S3 uploads failing with `AccessDenied`

Verify the following in your `.env`:
- `STORAGE_PROVIDER=s3`
- `STORAGE_PROVIDER` is `s3` (not `r2`) and `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` are correct. For R2 or MinIO also set `S3_ENDPOINT`. The credential variable names are always the `S3_*` pair; there is no `AWS_*` variant
- The IAM user has `s3:PutObject` and `s3:GetObject` permissions on the target bucket

---

## 8. Biome Lint Errors

### Biome not found

Biome is installed as a dev dependency. Run `pnpm install` from the monorepo root.

### Auto-fix not working in VS Code

Install the [Biome VS Code extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) and ensure `editor.formatOnSave` is enabled. Check that `.vscode/settings.json` sets `"editor.defaultFormatter": "biomejs.biome"`.

### `import` ordering errors

Biome enforces import order. Run `pnpm lint` to auto-fix, or use the Biome VS Code extension to fix on save.

---

## 9. Template Sync

### CI fails with "template drift detected"

The scaffold templates in `packages/cli/templates/` are out of date. After changing any source file in `apps/web/`, `apps/worker/`, `packages/db/`, `packages/config/`, `packages/ui/`, or `packages/jobs/`, run:

```bash
pnpm --filter @usequark/quark-create-app sync-templates
```

Then commit the updated templates along with your source changes.

### `sync-templates` overwrites a file I edited manually

Files listed as `TEMPLATE_ONLY` in `packages/cli/scripts/sync-templates.js` are never overwritten. If you need to protect a file from sync, add it to that list.

### Scaffolded project has outdated templates

The CLI packages templates at publish time. To get updated templates, upgrade the CLI:

```bash
npm install -g @usequark/quark-create-app@latest
npx @usequark/quark-create-app my-app
```

---

## 10. Tests Failing

### `Error: connect ECONNREFUSED` in tests

Tests require a running Postgres and Redis instance. Start them with:

```bash
docker compose up -d
```

### Tests pass locally but fail in CI

Check that CI has the `docker-compose.yml` services running. The GitHub Actions workflow uses `services:` to start Postgres and Redis automatically. Verify the `DATABASE_URL` and `REDIS_URL` environment variables are set correctly in CI.

### A specific test file fails with `ERR_MODULE_NOT_FOUND`

You may have a missing or misspelled package import. Run `pnpm install` and `pnpm db:generate` to ensure all dependencies are present.

### Test coverage is lower than expected

Co-locate test files (`*.test.js`) next to the source file. Root `pnpm test` runs `node --test 'scripts/*.test.mjs' && turbo run test`; each workspace's own `test` script delegates to `scripts/run-tests.mjs <dir>`, which discovers the co-located files. A directly-run workspace suite therefore needs `pnpm db:generate` first when it touches Prisma, because `turbo run test` normally handles that dependency.
