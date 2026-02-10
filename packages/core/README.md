# @Bobnoddle/quark-core - The Quark Platform Core

The central "plumbing" package for the Quark platform. Every Quark application inherits this core infrastructure, providing database access, authentication, job queuing, and error handling out of the box.

## Philosophy

`@Bobnoddle/quark-core` provides **opinionated, zero-configuration defaults** for common infrastructure concerns:

- **Database**: Prisma ORM with singleton pattern
- **Authentication**: Next-auth helpers with sensible defaults
- **Job Queue**: BullMQ integration for background jobs
- **Error Handling**: Standardized, serializable error types
- **Utilities**: Common functions for retries, validation, etc.

Applications **inherit these tools** but can **extend and override** them as needed.

## Core Principles

### What Goes in Core

✅ **Belongs in Core:**
- Infrastructure-level utilities (DB, Auth, Queue, Errors)
- Patterns that every app needs
- Zero-configuration defaults
- Type definitions
- Provider-agnostic helpers

❌ **Does NOT belong in Core:**
- Application-specific business logic
- Domain models (use Prisma schema instead)
- UI components (use @Bobnoddle/quark-ui)
- Config-specific settings (use environment variables)

### What Gets "Ejected"

The "ejection" pattern allows apps to customize Core defaults:

```javascript
// Import core helpers
import { createAuthConfig, createQueue } from "@Bobnoddle/quark-core";

// Override/extend with app-specific config
export const authConfig = createAuthConfig({
  providers: [GitHubProvider(...)],
  callbacks: {
    async jwt({ token, user }) {
      // Custom JWT logic
      return token;
    }
  }
});
```

## Usage

### Database Client

Access the Prisma singleton client:

```javascript
import { createDbClient } from "@Bobnoddle/quark-core";

const db = createDbClient();

const user = await db.user.findUnique({
  where: { id: "123" }
});
```

In development, the client automatically attaches to `globalThis` to prevent hot-reload issues.

### Authentication

Create a next-auth configuration with defaults:

```javascript
import { createAuthConfig, getCurrentSession, getUserId } from "@Bobnoddle/quark-core";

export const authConfig = createAuthConfig({
  providers: [GitHubProvider({ ... })],
});

// In a server action/API route:
import { getSession } from "next-auth/react";

const session = await getCurrentSession(getSession);
if (!session) {
  throw new UnauthorizedError();
}

const userId = getUserId(session);
```

#### Available Auth Functions

- `createAuthConfig(options)` - Creates next-auth config
- `getCurrentSession(getSession)` - Safely retrieves session
- `isAuthenticated(session)` - Checks if session is valid
- `getUserId(session)` - Extracts user ID
- `getUserEmail(session)` - Extracts user email
- `requireAuth(session)` - Throws error if not authenticated

### Job Queue

Initialize background job processing:

```javascript
import { createQueue, createWorker, addJob } from "@Bobnoddle/quark-core";

// Create a queue
const emailQueue = createQueue("emails", {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  }
});

// Process jobs
createWorker("emails", async (job) => {
  await sendEmail(job.data);
  return { success: true };
});

// Add a job
await addJob(emailQueue, "send-email", {
  to: "user@example.com",
  subject: "Welcome!",
});
```

#### Available Queue Functions

- `createQueue(name, options)` - Creates a BullMQ queue
- `createWorker(queueName, handler, options)` - Creates a job processor
- `addJob(queue, jobName, data, jobOptions)` - Adds a job to queue
- `getJobStatus(job)` - Gets job status/progress
- `clearQueue(queue)` - Clears all jobs from queue
- `closeAllQueues()` - Gracefully closes all queues
- `checkQueueHealth()` - Checks Redis connectivity

### Error Handling

Use standardized error types:

```javascript
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  AppError,
  logError,
  normalizeError,
} from "@Bobnoddle/quark-core";

// Throw specific errors
if (!email) {
  throw new ValidationError("Email is required");
}

if (!session) {
  throw new UnauthorizedError("Please log in");
}

if (!user) {
  throw new NotFoundError("User not found");
}

// Error types automatically serialize to JSON:
// {
//   "name": "ValidationError",
//   "message": "Email is required",
//   "code": "VALIDATION_ERROR",
//   "statusCode": 400,
//   "timestamp": "2026-02-04T10:00:00.000Z"
// }

// Handle errors with context
try {
  await someOperation();
} catch (error) {
  logError(error, { userId: "123", context: "email_signup" });
}
```

#### Available Error Types

- `AppError` - Base class (500)
- `ValidationError` - Bad input (400)
- `UnauthorizedError` - Not authenticated (401)
- `ForbiddenError` - Not authorized (403)
- `NotFoundError` - Resource missing (404)
- `ConflictError` - Resource conflict (409)
- `RateLimitError` - Too many requests (429)
- `DatabaseError` - Database issue (500)
- `ServiceError` - External service failure (502)

### Utilities

Common helper functions:

```javascript
import {
  retryAsync,
  validateEnv,
  deepMerge,
  randomString,
  sanitizeId,
  measureTime,
  memoize,
} from "@Bobnoddle/quark-core";

// Retry with exponential backoff
const result = await retryAsync(
  () => fetchFromExternalAPI(),
  {
    maxAttempts: 5,
    initialDelay: 1000,
    onRetry: ({ attempt, delay }) => {
      console.log(`Retry ${attempt} after ${delay}ms`);
    }
  }
);

// Validate environment
validateEnv(["DATABASE_URL", "REDIS_HOST"]);

// Merge configurations
const config = deepMerge(defaults, userConfig);

// Generate IDs
const id = randomString(12);

// Sanitize for URLs
const slug = sanitizeId("Hello World"); // "hello-world"

// Measure performance
const { result, duration } = await measureTime(async () => {
  return await expensiveOperation();
});
console.log(`Completed in ${duration}ms`);

// Cache results
const getCachedUser = memoize(
  (id) => db.user.findUnique({ where: { id } }),
  60000 // 1 minute TTL
);
```

## Environment Configuration

Core respects these environment variables:

```bash
# Database
DATABASE_URL=postgresql://...

# Redis/Queue
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Authentication
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000

# Node
NODE_ENV=development
```

## Testing Core

Core includes unit tests verifying all functionality:

```bash
cd packages/core
pnpm test
```

See [Core Tests](./test/) for examples.

## Extending Core

### Custom Error Types

```javascript
import { AppError } from "@Bobnoddle/quark-core";

export class PaymentError extends AppError {
  constructor(message, code = "PAYMENT_FAILED") {
    super(message, 402, code);
  }
}
```

### Custom Queue Handlers

```javascript
import { createWorker } from "@Bobnoddle/quark-core";

createWorker("analytics", async (job) => {
  await trackEvent(job.data);
}, {
  concurrency: 10,
  redis: {
    host: "redis-prod.internal",
    port: 6379,
  }
});
```

### Middleware & Hooks

```javascript
import { createDbClient } from "@Bobnoddle/quark-core";

const db = createDbClient({
  middleware: [
    {
      $use: async (params, next) => {
        const before = Date.now();
        const result = await next(params);
        const after = Date.now();
        console.log(`${params.model}.${params.action} took ${after - before}ms`);
        return result;
      },
    },
  ],
});
```

## Architecture

```
@Bobnoddle/quark-core/
├── src/
│   ├── index.js          # Main exports
│   ├── auth/
│   │   └── index.js      # Next-auth helpers
│   ├── db/
│   │   └── index.js      # Prisma client factory
│   ├── queue/
│   │   └── index.js      # BullMQ integration
│   ├── errors.js         # Error types & utilities
│   ├── utils.js          # Common helpers
│   ├── types.js          # Type definitions
│   ├── auth.test.js      # Auth tests
│   ├── queue.test.js     # Queue tests
│   ├── errors.test.js    # Error tests
│   └── utils.test.js     # Utils tests
└── package.json
```

## Migration Path from Existing Apps

If you're migrating from an existing app:

1. **Keep your current setup** - Core is not required
2. **Extract shared patterns** - Move common code to Core
3. **Test independently** - Ensure Core works standalone
4. **Adopt gradually** - Start using Core utilities piece by piece
5. **Eject where needed** - Override defaults in your app

Example migration:

```javascript
// Before: app-specific auth.js
export const authConfig = { ... };

// After: inherit and extend from Core
import { createAuthConfig } from "@Bobnoddle/quark-core";

export const authConfig = createAuthConfig({
  providers: [...],  // add app-specific providers
});
```

## Troubleshooting

### Prisma Client Issues

**"Cannot find Prisma Client"**
- Ensure `@prisma/client` is installed: `pnpm install`
- Run `pnpm db:generate` to build Prisma client

### Queue Connection Issues

**"Redis connection refused"**
- Check REDIS_HOST and REDIS_PORT
- Ensure Redis is running: `docker-compose up redis`

### Auth Issues

**"NEXTAUTH_SECRET is not set"**
- Set in production: `export NEXTAUTH_SECRET=<random-string>`
- Or pass via `createAuthConfig({ secret: '...' })`

## Contributing

When adding features to Core:

1. ✅ **Add comprehensive JSDoc comments**
2. ✅ **Create unit tests** in `*.test.js`
3. ✅ **Update this README**
4. ✅ **Keep it framework-agnostic** where possible
5. ✅ **Document configuration options**

## License

ISC - Part of the Quark Platform
