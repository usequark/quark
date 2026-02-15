# @techstream/quark-core

Shared infrastructure for the Quark platform — authentication, job queues, error handling, and utilities.

## What's Included

- **Authentication** — Next-auth helpers (`createAuthConfig`, `requireAuth`, password hashing)
- **Job Queue** — BullMQ integration (`createQueue`, `createWorker`, `addJob`)
- **Errors** — Standardized error types (`ValidationError`, `NotFoundError`, `UnauthorizedError`, etc.)
- **Utilities** — `retryAsync`, `deepMerge`, `randomString`, `sanitizeId`, `measureTime`, `memoize`
- **Validation** — Zod-based request body validation
- **Redis / Mailhog** — Connection helpers for Redis and Mailhog

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

## Testing

```bash
cd packages/core
pnpm test
```

## Support

For issues, questions, and discussions:
- 🐛 [Issue Tracker](https://github.com/Bobnoddle/quark/issues)
- 💬 [Discussions](https://github.com/Bobnoddle/quark/discussions)
