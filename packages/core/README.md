# @techstream/quark-core

Shared infrastructure for the Quark platform - authentication, job queues, error handling, and utilities.

## What's Included

- **Authentication** - Auth.js-compatible config helpers (`createAuthConfig`, `requireAuth`, password hashing) plus framework-agnostic session guards (`requireSession`, `requireSessionRole`, `createAuthMiddleware`)
- **Database** - Prisma client singleton (`createPrismaClient`), connection-string/pool helpers, and a `pingDatabase()` health check
- **Admin** - Prisma schema introspection (`parseSchema`, `getModels`, `getEnums`, `coerceId`) for auto-generated admin UIs
- **Job Queue** - BullMQ integration (`createQueue`, `createWorker`, `addJob`)
- **Storage** - Local filesystem built in; S3/R2/MinIO via optional AWS SDK install in the app
- **Errors** - Standardized error types (`ValidationError`, `NotFoundError`, `UnauthorizedError`, etc.)
- **Utilities** - `retryAsync`, `deepMerge`, `randomString`, `sanitizeId`, `measureTime`, `memoize`
- **Validation** - Zod-based request body validation
- **Redis / Mail** - Connection helpers for Redis and local mail (Mailpit)

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
} from "@techstream/quark-core";
```

All modules are re-exported from the package root. See JSDoc comments on each function for options and usage details.

### Subpath exports

Prefer a subpath when you want a smaller import graph or the browser-safe logger:

| Subpath | Contents |
|---|---|
| `@techstream/quark-core/core` | errors, logger, validation, utils, pagination, csrf, rate limiter, file validation, db |
| `@techstream/quark-core/db` | Prisma singleton, connection string, pool config, `pingDatabase()` |
| `@techstream/quark-core/admin` | Prisma schema introspection helpers |
| `@techstream/quark-core/auth` | auth config helpers + session guards |
| `@techstream/quark-core/auth/middleware` | session guards only |
| `@techstream/quark-core/storage` | local adapter, storage factory, key/URL helpers, `createS3Storage` |
| `@techstream/quark-core/storage/s3` | S3 adapter only |
| `@techstream/quark-core/logger` | browser-safe logger |
| `@techstream/quark-core/locale` | locale helpers |
| `@techstream/quark-core/stripe` | Stripe client + webhook helpers |

`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `pg`, and `stripe` are optional peer dependencies. They are only loaded when the matching feature is used, so apps that do not use S3, `pingDatabase()`, or payments do not need them installed.

## Testing

```bash
cd packages/core
pnpm test
```

## Support

For issues, questions, and discussions:
- 🐛 [Issue Tracker](https://github.com/Bobnoddle/quark/issues)
- 💬 [Discussions](https://github.com/Bobnoddle/quark/discussions)
