# Quark Worker Service

Background job processor for the Quark monorepo using **BullMQ** and **Redis**. Handles asynchronous tasks like email delivery, file cleanup, and domain-specific business logic.

## Architecture Overview

The worker service is designed around resilience, observability, and graceful degradation:

```
┌─────────────────────────────────────────────────────┐
│  Worker Service (apps/worker)                       │
├─────────────────────────────────────────────────────┤
│  Init Phase:                                        │
│  └─ Health checks (Redis, Database)                 │
│  └─ Register handlers for all queues                │
│  └─ Start listening for jobs                        │
├─────────────────────────────────────────────────────┤
│  Runtime Phase:                                     │
│  └─ Dispatch jobs to registered handlers            │
│  └─ Log events at each state transition             │
│  └─ Persist each state change to the Job table      │
├─────────────────────────────────────────────────────┤
│  Shutdown Phase:                                    │
│  └─ Close workers (releases their Redis connections)│
│  └─ Disconnect the database                         │
│  └─ Exit with success/failure code                  │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Development

```bash
# Start local infrastructure
docker compose up -d

# Run worker in watch mode
pnpm dev

# Run tests
pnpm test

# Check code style
pnpm lint
```

### Preflight Check (Deployment)

Before deploying, verify that the worker can connect to all required services:

```bash
# Run health checks without starting the job listener
pnpm preflight

# Exit codes:
# 0 = All systems ready
# 1 = Connection failure or health check failed
```

The preflight check runs `node src/index.js --preflight` and validates:
- Redis connectivity
- Database connectivity (Prisma)
- All required environment variables
- Job handler registration

## Configuration & Environment Variables

### Redis Configuration

```env
# Redis connection (defaults: localhost:6379)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

Read by `packages/core/src/redis.js` (`resolveRedisConnection`). `REDIS_URL` is
preferred when set, and may carry credentials and TLS:

```env
REDIS_URL=redis://user:password@your-redis-host:6379
REDIS_URL=rediss://your-redis-host:6380          # rediss:// enables TLS
```

There is no `REDIS_PASSWORD`, `REDIS_TLS_CA`, `REDIS_TLS_CERT`, or `REDIS_TLS_KEY`
support - certificate-based auth is not implemented. Pass credentials in the URL.

### Worker Configuration

```env
# Job processing
WORKER_CONCURRENCY=5                  # Number of concurrent jobs per queue
WORKER_HEALTH_RETRIES=10              # Max attempts to connect to Redis on startup
WORKER_HEALTH_INTERVAL_MS=1000        # Delay between Redis health check attempts (ms)
WORKER_DB_RETRIES=30                  # Max attempts waiting for the DB schema
WORKER_DB_INTERVAL_MS=2000            # Delay between DB schema checks (ms)

# Graceful shutdown
# No drain timeout exists yet - shutdown waits on worker.close() for as long as
# BullMQ takes, with no upper bound. WORKER_SHUTDOWN_TIMEOUT_MS is not read by
# any code, so set your orchestrator's terminationGracePeriod generously.
```

There is no circuit breaker. `WORKER_MAX_FAILURES` is not read by any code, and the
worker tracks no failure counter - an error is logged and the job is either retried
by BullMQ or marked failed.

### Job Queue Configuration

`packages/jobs/src/definitions.js` only names the queues and job types. The retry
defaults live in `createQueue()` in `packages/core/src/queue/index.js`; jobs inherit
them from the queue they are added to:

```javascript
// Default retry strategy for all jobs (packages/core/src/queue/index.js)
{
  attempts: 3,                    // Retry up to 3 times
  backoff: {
    type: "exponential",          // 2s → 4s → 8s delays
    delay: 2000
  },
  removeOnComplete: { age: 60, count: 100 }  // Keep the last 100 for 60s
}
```

Queues: `email-queue`, `files-queue`, `push-queue`, `default-queue`. The worker
starts one BullMQ worker per queue and dispatches by job name, so any registered
handler in a queue will be picked up by that queue's worker.

### Database Configuration

Worker uses the local `@usequark/quark-db` package which requires:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/quark_dev
```

## Package.json Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Run worker in watch mode (tsx watch) |
| `pnpm preflight` | Execute health checks and exit |
| `pnpm test` | Run all tests in src/*.test.js |
| `pnpm lint` | Format and lint code with Biome |

## Job Handler Patterns

All job handlers are registered in `src/handlers/index.js`, mapping job names from
`@usequark/quark-jobs`:

| Job name | Handler |
|---|---|
| `send-welcome-email` | `handleSendWelcomeEmail` (`handlers/email.js`) |
| `send-reset-password-email` | `handleSendResetPasswordEmail` (`handlers/email.js`) |
| `cleanup-orphaned-files` | `handleCleanupOrphanedFiles` (`handlers/files.js`) |
| `send-push-notification` | `handleSendPushNotification` (`handlers/push-notification.js`) |

⚠️ `send-push-notification` is registered but inoperable today: the handler queries
`prisma.device`, and there is no `Device` model in `packages/db/prisma/schema.prisma`
(the schema holds 7 core models). Every `send-push-notification` job fails on its
first database call. Add a `Device` model (see the `add-model` skill) or drop the
registration - the handler is not dead code you can switch on with config.

The shipped web app only enqueues `send-welcome-email`
(`apps/web/src/lib/enqueue-welcome-email.js`); the worker itself schedules
`cleanup-orphaned-files` every 24h via `upsertJobScheduler`.

The shipped handler pulls its guards out into `handlers/email-job-validation.js`
(`requireWelcomeEmailUserId`, `requireUserEmailRecord`) so they can be unit-tested
without Prisma. `src/handlers/email.js` reads, in outline:

```javascript
// src/handlers/email.js
import { createEmailService } from "@usequark/quark-core/email";
import { welcomeEmail, passwordResetEmail } from "@usequark/quark-core/email-templates";
import { prisma } from "@usequark/quark-db";
import { requireUserEmailRecord, requireWelcomeEmailUserId } from "./email-job-validation.js";

const emailService = createEmailService();

export async function handleSendWelcomeEmail(bullJob, logger) {
  const userId = requireWelcomeEmailUserId(bullJob.data);

  logger.info(`Sending welcome email for user ${userId}`, {
    job: "send-welcome-email",
    userId,
  });

  const userRecord = requireUserEmailRecord(
    userId,
    await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    }),
  );

  const template = welcomeEmail({
    name: userRecord.name,
    appName: process.env.APP_NAME,
    loginUrl: process.env.APP_URL
      ? `${process.env.APP_URL}/api/auth/signin`
      : undefined,
  });

  await emailService.sendEmail(
    userRecord.email,
    template.subject,
    template.html,
    template.text,
  );

  return { success: true, userId, email: userRecord.email };
}
```

### Handler Signature

Every job handler receives:

```javascript
async function jobHandler(bullJob, logger) {
  // bullJob.id          - unique job ID
  // bullJob.name        - job type (e.g., "send-welcome-email")
  // bullJob.data        - payload from queue.add()
  // bullJob.attemptsMade- number of attempts already made
  // logger              - createLogger() instance (info/warn/error/fatal)

  // Return: success result (serializable)
  // Throw: Error (triggers retry or failure). Prefer ValidationError/AppError
  // from @usequark/quark-core/errors over a bare Error.
  return { success: true };
}
```

### Error Handling in Handlers

`handleCleanupOrphanedFiles` is the pattern to copy - it continues past a failing
record and reports what it could not delete:

```javascript
// src/handlers/files.js
export async function handleCleanupOrphanedFiles(bullJob, logger) {
  const retentionHours = bullJob.data?.retentionHours || 24;
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

  logger.info("Starting orphaned file cleanup", { retentionHours, cutoff });

  const orphaned = await file.findOlderThan(cutoff);
  const storage = createStorage();
  let deleted = 0;
  const errors = [];

  for (const record of orphaned) {
    try {
      // Row first, storage second - a failed row delete cannot be recovered,
      // a failed storage delete is swept up by the next pass of this job.
      const { count } = await file.deleteIfPresent(record.id);
      if (count === 0) continue; // taken by a concurrent request or earlier pass

      await storage.delete(record.storageKey);
      deleted++;
    } catch (err) {
      errors.push({ id: record.id, error: err.message });
      logger.warn(`Failed to delete file ${record.id}: ${err.message}`);
    }
  }

  return { success: true, deleted, total: orphaned.length, errors };
}
```

## Testing Module Exports

Test patterns for the resilience utilities are in `index.test.js`:

### Testing `isConnectionError`

Detects Redis connection errors (network failures, misconfiguration):

```javascript
import { isConnectionError } from "./index.js";

test("isConnectionError detects common connection failures", () => {
  const econnRefused = new Error("connect ECONNREFUSED 127.0.0.1:6379");
  assert.strictEqual(isConnectionError(econnRefused), true);

  const econnReset = new Error("read ECONNRESET");
  assert.strictEqual(isConnectionError(econnReset), true);

  const enotFound = new Error("getaddrinfo ENOTFOUND redis.example.com");
  assert.strictEqual(isConnectionError(enotFound), true);

  const etimedOut = new Error("connect ETIMEDOUT");
  assert.strictEqual(isConnectionError(etimedOut), true);

  const otherError = new Error("Invalid queue name");
  assert.strictEqual(isConnectionError(otherError), false);
});
```

### Testing `throttledError`

Suppresses repeated errors within a time window. Note that `throttledError` logs at
**warn**, not error — it reports "Waiting for Redis", a recoverable condition:

```javascript
import { throttledError } from "./index.js";

test("throttledError suppresses duplicate errors within window", async () => {
  const logger = createMockLogger();
  const throttle = throttledError(logger, 100); // 100ms window

  // First error logs
  throttle(new Error("Redis unavailable"));
  assert.strictEqual(logger.warn.mock.callCount(), 1);

  // Second error within window suppressed
  throttle(new Error("Redis unavailable"));
  assert.strictEqual(logger.warn.mock.callCount(), 1);

  // After window, error logs again
  await new Promise(r => setTimeout(r, 150));
  throttle(new Error("Redis unavailable"));
  assert.strictEqual(logger.warn.mock.callCount(), 2);
});
```

### Testing `waitForRedis`

Retries health checks with exponential backoff:

```javascript
import { waitForRedis } from "./index.js";

test("waitForRedis retries on connection failure", async () => {
  const config = {
    maxRetries: 3,
    intervalMs: 50
  };

  let attempts = 0;
  const health = async () => {
    attempts++;
    if (attempts < 2) throw new Error("Not ready");
    return true;
  };

  const result = await waitForRedis(health, config);
  assert.strictEqual(result, true);
  assert.strictEqual(attempts, 2);
});
```

## Docker Compose Configuration

The worker requires a properly configured Redis service. This should be present in your `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "${REDIS_PORT:-6379}:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
```

The `healthcheck` definition allows Docker/Kubernetes orchestrators to detect readiness:

```bash
# Check health status
docker inspect redis | jq '.State.Health.Status'

# Watch health changes
docker inspect redis | jq '.' | grep -A 5 Health
```

## Deployment & Readiness Checks

### Local/Development

```bash
# Terminal 1: Start infrastructure
docker compose up -d

# Terminal 2: Run preflight (quick validation)
pnpm preflight

# Terminal 3: Start worker
pnpm dev
```

### Container Orchestration (Kubernetes, Docker Compose, Railway)

Prefer the **preflight flag** for readiness probes:

```yaml
# Kubernetes example
apiVersion: v1
kind: Pod
metadata:
  name: quark-worker
spec:
  containers:
  - name: worker
    image: node:24-alpine
    command: ["node", "src/index.js"]
    readinessProbe:
      exec:
        command: ["node", "src/index.js", "--preflight"]
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 5
    livenessProbe:
      exec:
        command: ["node", "src/index.js", "--preflight"]
      initialDelaySeconds: 30
      periodSeconds: 30
```

```yaml
# Docker Compose example
services:
  worker:
    build: .
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "src/index.js", "--preflight"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Graceful Shutdown

The worker handles `SIGTERM` and `SIGINT` signals:

```javascript
// When orchestrator sends SIGTERM (deployment update, node drain, etc.)
async function shutdown(signal) {
  logger.info("Graceful shutdown initiated", { signal });

  // 1. Stop intake and close workers - BullMQ waits for in-flight jobs to
  //    return or throw. There is no built-in 30s cap (no WORKER_SHUTDOWN_TIMEOUT_MS),
  //    so a stuck handler blocks this loop indefinitely.
  for (const worker of workers) {
    await worker.close();
  }

  // 2. Disconnect the database
  await prisma.$disconnect();

  // 3. Exit cleanly
  process.exit(0);
}
```

**Important**: because there is no drain timeout of its own, the worker relies on your
orchestrator's grace period. Configure it above the longest job you expect to run:

```yaml
# Kubernetes
terminationGracePeriodSeconds: 40

# Docker Compose
stop_grace_period: 40s
```

## Architectural Patterns

### Error Handling Strategy

The worker uses a **fault-tolerant error handling** approach:

1. **Job-Level Errors**: Failures inside handlers trigger retries with exponential backoff (3 attempts, 2s → 4s → 8s, from `createQueue` defaults)
2. **Connection Errors**: Temporary network issues don't crash the process, they're throttled (`throttledError`, warn level)
3. **Permanent Failures**: After the retries are exhausted the job is marked `failed`, logged, and persisted to the `Job` table as `FAILED`. There is **no dead-letter queue** — a job that has used every attempt stays in the `failed` set in Redis with nothing re-dispatching it
4. **Process-Level Errors**: Unhandled errors exit the process (expect orchestrator restart)

### State Management

Workers maintain minimal state:

```javascript
// Global state (kept to a minimum)
const workers = [];         // Active queue workers
let devDisabledKeepAlive = null; // Dev-only keep-alive timer
let depthTimer = null;      // Queue-depth gauge refresh timer
let isShuttingDown = false; // Graceful shutdown flag

// Why minimal? Stateless workers are easier to:
// - Scale horizontally
// - Deploy without coordination
// - Replace during updates
```

### Connection Resilience

```javascript
// On startup, wait for Redis with retries
await waitForRedis(checkHealth, {
  maxRetries: parseInt(process.env.WORKER_HEALTH_RETRIES || "10"),
  intervalMs: parseInt(process.env.WORKER_HEALTH_INTERVAL_MS || "1000")
});

// During runtime, throttle connection errors
const reportError = throttledError(logger, 5000);

// Distinguish connection issues from application errors
if (isConnectionError(error)) {
  reportError(error); // Already throttled, might not log
  // Don't exit; orchestrator restart will help
} else {
  logger.error("Application error", { error });
  // Exit on app-level errors; orchestrator should restart
}
```

### Graceful Shutdown

The shutdown sequence stops intake, closes each worker (which releases its Redis
connection), and disconnects Prisma:

```javascript
// Signal received (SIGTERM from orchestrator)
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

async function shutdown(signal) {
  isShuttingDown = true;
  // 1. Stop the queue-depth gauge and the dev keep-alive timer
  clearInterval(depthTimer);
  // 2. Close every worker. BullMQ waits for the jobs already being processed
  //    to return or throw - there is no WORKER_SHUTDOWN_TIMEOUT_MS cap on this,
  //    so a handler that never returns blocks shutdown indefinitely.
  for (const worker of workers) await worker.close();
  // 3. Disconnect the database
  await prisma.$disconnect();
  // 4. Exit
  process.exit(0);
}
```

Because there is no drain timeout, a stuck handler holds the process open. Set your
orchestrator's `terminationGracePeriodSeconds` / `stop_grace_period` above the
longest job you expect to run, and treat that as the only bound.

## Development Experience Improvements

### Local Development Workflow

```bash
# 1. Terminal 1: Start all services
docker compose up -d

# 2. Terminal 2: Test database connection
pnpm db:generate  # Ensure Prisma client is current
pnpm db:seed      # Populate test data if needed

# 3. Terminal 3: Start worker
pnpm dev

# 4. Terminal 4 (optional): Queue jobs
node -e "
  import { createQueue } from '@usequark/quark-core';
  const q = createQueue('emails');
  const job = await q.add('send-welcome-email', { userId: 'test-1' });
  console.log('Job enqueued:', job.id);
"
```

### Debugging Tips

**Enable verbose logging**: the worker's logger (`createLogger` from core) reads
`LOG_LEVEL`; `debug` is the default outside production. Force it with:

```bash
LOG_LEVEL=debug pnpm dev
```

`DEBUG=*` has no effect — the repo does not use the `debug` package.

**Inspect job state**: job records are persisted to the `Job` table, so Prisma
Studio shows them. `pnpm db:studio` runs from `packages/db` (this repo root has no
such script):

```bash
pnpm --filter @usequark/quark-db db:studio
```

**Monitor queue in real-time**: Connect to Redis CLI

```bash
redis-cli
> MONITOR
> LRANGE bull:emails:wait 0 -1
```

**Test a specific handler**:

```bash
node -e "
  import { handleSendWelcomeEmail } from './src/handlers/email.js';
  const logger = console;
  const job = { data: { userId: 'test-123' }, id: 'job-1' };
  await handleSendWelcomeEmail(job, logger);
"
```

### Performance Considerations

- **Concurrency**: Default 5 jobs/queue. Adjust via `WORKER_CONCURRENCY`
- **Memory**: Each job handler runs in the same process. Memory leaks compound
- **Timeouts**: none are configured. A handler that never returns blocks that
  concurrency slot (and shutdown) indefinitely — enforce your own timeouts in the
  handler if the downstream call has no timeout of its own
- **Database Connections**: Worker reuses a single Prisma client across all jobs

If you need horizontal scaling:

```bash
# Each worker process is independent
# Deploy multiple instances; they'll auto-divide work via Redis
# (NODE_INSTANCE_ID is illustrative only - the worker does not read it)
```

## Complete Example: Send Email Job

Here's a full example combining all patterns:

**Job Handler** (`src/handlers/email.js`):

```javascript
import { createEmailService } from "@usequark/quark-core/email";
import { welcomeEmail } from "@usequark/quark-core/email-templates";
import { prisma } from "@usequark/quark-db";
import { JOB_NAMES } from "@usequark/quark-jobs";
import {
  requireUserEmailRecord,
  requireWelcomeEmailUserId,
} from "./email-job-validation.js";

const emailService = createEmailService();

export async function handleSendWelcomeEmail(bullJob, logger) {
  const userId = requireWelcomeEmailUserId(bullJob.data);

  logger.info(`Sending welcome email for user ${userId}`, {
    job: JOB_NAMES.SEND_WELCOME_EMAIL,
    userId,
  });

  const userRecord = requireUserEmailRecord(
    userId,
    await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    }),
  );

  const template = welcomeEmail({
    name: userRecord.name,
    appName: process.env.APP_NAME,
    loginUrl: process.env.APP_URL
      ? `${process.env.APP_URL}/api/auth/signin`
      : undefined,
  });

  await emailService.sendEmail(
    userRecord.email,
    template.subject,
    template.html,
    template.text,
  );

  return { success: true, userId, email: userRecord.email };
}
```

Templates return `{ subject, html, text }` - pass them straight through. `welcomeEmail`
and `passwordResetEmail` live in `@usequark/quark-core/email-templates`.

**Tests**: there is no `src/handlers/email.test.js`. The handler's guards are
unit-tested through the validation helpers in `src/index.test.js` (describe blocks
"handleSendWelcomeEmail" / "handleSendResetPasswordEmail"), and
`src/handlers/files.test.js` covers `handleCleanupOrphanedFiles`.

```javascript
// src/index.test.js (abridged)
import assert from "node:assert";
import { describe, test } from "node:test";
import { AppError } from "@usequark/quark-core/errors";
import { requireUserEmailRecord } from "./handlers/email-job-validation.js";

describe("handleSendWelcomeEmail", () => {
  test("throws when user is not found", () => {
    assert.throws(
      () => requireUserEmailRecord("user-123", null),
      (error) => {
        assert.ok(error instanceof AppError);
        assert.strictEqual(error.code, "USER_EMAIL_NOT_FOUND");
        return true;
      },
    );
  });
});
```

## FAQ

**Q: Why is my worker not starting?**
A: Check preflight: `pnpm preflight`. Common issues: Redis not running, DATABASE_URL not set, env vars not loaded.

**Q: How do I see job processing logs?**
A: Run in watch mode: `pnpm dev`. Logs include job ID, completion time, and any errors.

**Q: Can I process jobs in parallel?**
A: Yes! Increase `WORKER_CONCURRENCY`. Each worker can handle N jobs simultaneously.

**Q: What happens if a job fails?**
A: BullMQ retries with exponential backoff (default: 3 attempts, starting at 2s delay). After final retry, the job moves to a "failed" state.

**Q: How do I add a new job type?**
A: 1. Define in `@usequark/quark-jobs`
2. Implement handler in `src/handlers/`
3. Register in `src/handlers/index.js`
4. Test with `src/handlers/*.test.js`

## Further Reading

- [QUARK_USAGE.md](../../docs/QUARK_USAGE.md) - Framework guidelines
- [ARCHITECTURE.md](../../docs/ARCHITECTURE.md) - Core-only registry model
- [DATABASE.md](../../docs/DATABASE.md) - Prisma setup and patterns
- [BullMQ Docs](https://docs.bullmq.io) - Job queue internals
