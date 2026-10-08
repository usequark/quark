# @usequark/quark-core

Shared infrastructure for the Quark platform - authentication, job queues, error handling, and utilities.

## What's Included

- **Authentication** - Auth.js-compatible config helpers (`createAuthConfig`, `requireAuth`, password hashing) plus framework-agnostic session guards (`requireSession`, `requireSessionRole`, `createAuthMiddleware`), and role checks (`authorization.js`)
- **Database** - `createPrismaClient(ClientClass)` builds a client from your generated Prisma class, plus connection-string/pool helpers, `pingDatabase()`, and `db-instrumentation`
- **Job Queue** - BullMQ integration (`createQueue`, `createWorker`, `addJob`, queue definitions)
- **Email** - Provider registry (`EmailProvider`, `registerEmailProvider`), `createEmailService`, and built-in templates
- **Storage** - Local filesystem built in; S3 and any S3-compatible endpoint (R2, MinIO) via optional AWS SDK install in the app
- **Metrics** - Prometheus-style registry (`createMetrics`, `metrics`, `httpRequestsTotal`, `jobQueueDepth`, `jobDuration`, and more)
- **Health** - `runHealthChecks`, `createDefaultProbes`, `checkStorage`, `checkQueues`, `logHealthReport`
- **Security** - CSRF tokens, rate limiting (in-memory with Redis fallback), file and multipart validation, request logging, error reporting
- **Errors** - Standardized error types (`ValidationError`, `NotFoundError`, `UnauthorizedError`, `AppError`, and others)
- **Utilities** - `retryAsync`, `deepMerge`, `randomString`, `sanitizeId`, `measureTime`, `memoize`, query builder, pagination, cache, locale helpers
- **Validation** - Zod-based request body validation
- **Payments and messaging** - Stripe client and webhook helpers, SMS provider
- **Schema introspection** - `parseSchema`, `getModels`, `getEnums`, `getModelByName`, `coerceId`, `resetSchemaCache`
- **Redis / Mail** - Connection helpers for Redis and local mail (Mailpit)
- **Testing** - factories, mocks, and helpers under `@usequark/quark-core/testing`

## Usage

```javascript
import {
  createAuthConfig,
  requireAuth,
  createQueue,
  createWorker,
  addJob,
  ValidationError,
  retryAsync,
} from "@usequark/quark-core";
```

All modules are re-exported from the package root. See JSDoc comments on each function for options and usage details.

### Subpath exports

Prefer a subpath when you want a smaller import graph or the browser-safe logger:

Every subpath in `packages/core/package.json` `exports`, verified against the file:

| Subpath | Contents |
|---|---|
| `@usequark/quark-core` | everything below, re-exported from the root |
| `@usequark/quark-core/core` | errors, logger, validation, utils, pagination, csrf, rate limiter, file validation, db |
| `@usequark/quark-core/auth` | auth config helpers + session guards |
| `@usequark/quark-core/auth/middleware` | session guards only |
| `@usequark/quark-core/db` | `createPrismaClient`, connection string, pool config, `pingDatabase()` |
| `@usequark/quark-core/queue` | BullMQ queue and worker helpers |
| `@usequark/quark-core/email` | `EmailProvider`, `registerEmailProvider`, `createEmailService` |
| `@usequark/quark-core/errors` | error classes only |
| `@usequark/quark-core/health` | health check runners and default probes |
| `@usequark/quark-core/metrics` | metrics registry and default instruments |
| `@usequark/quark-core/storage` | local adapter, storage factory, key/URL helpers, `createS3Storage` |
| `@usequark/quark-core/storage/s3` | S3 adapter only |
| `@usequark/quark-core/sms` | SMS provider |
| `@usequark/quark-core/stripe` | Stripe client + webhook helpers |
| `@usequark/quark-core/admin` | Prisma schema introspection helpers |
| `@usequark/quark-core/locale` | locale helpers |
| `@usequark/quark-core/logger` | browser-safe logger |
| `@usequark/quark-core/testing` | test factories, mocks, helpers |

`createPrismaClient` is a factory, not a singleton: it takes your generated Prisma `Client` class as its argument so core never depends on your generated client path.

`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `pg`, and `stripe` are optional peer dependencies. They are only loaded when the matching feature is used, so apps that do not use S3, `pingDatabase()`, or payments do not need them installed.

## Testing

```bash
cd packages/core
pnpm test
```

## Support

For issues, questions, and discussions:
- 🐛 [Issue Tracker](https://github.com/usequark/quark/issues)
- 💬 [Discussions](https://github.com/usequark/quark/discussions)
