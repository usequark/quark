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
│  └─ Track failures with exponential backoff         │
│  └─ Log events at each state transition             │
│  └─ Report errors to centralized error reporter     │
├─────────────────────────────────────────────────────┤
│  Shutdown Phase:                                    │
│  └─ Drain in-flight jobs gracefully (up to 30s)    │
│  └─ Close database connection                       │
│  └─ Close Redis connection                          │
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
REDIS_PASSWORD=          # Optional
REDIS_TLS_CA=           # Optional: Path to CA certificate
REDIS_TLS_CERT=         # Optional: Path to client certificate
REDIS_TLS_KEY=          # Optional: Path to client key
```

### Worker Configuration

```env
# Job processing
WORKER_CONCURRENCY=5                  # Number of concurrent jobs per queue
WORKER_HEALTH_RETRIES=10              # Max attempts to connect on startup
WORKER_HEALTH_INTERVAL_MS=1000        # Delay between health check attempts (ms)
WORKER_MAX_FAILURES=100               # Threshold for circuit breaker (jobs/minute)

# Graceful shutdown (in production, orchestrator timeout should be 5-10s more)
WORKER_SHUTDOWN_TIMEOUT_MS=30000      # Max time to drain in-flight jobs
```

### Job Queue Configuration

Job defaults are defined in `@techstream/quark-jobs`:

```javascript
// Default retry strategy for all jobs
{
  attempts: 3,                    // Retry up to 3 times
  backoff: {
    type: "exponential",          // 2s → 4s → 8s delays
    delay: 2000
  },
  removeOnComplete: true          // Clean up jobs after success
}
```

### Database Configuration

Worker uses the local `@techstream/quark-db` package which requires:

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

All job handlers are registered in `src/handlers/index.js`:

```javascript
// src/handlers/email.js
export async function handleSendWelcomeEmail(bullJob, logger) {
  const { userId } = bullJob.data;
  
  if (!userId) {
    throw new Error("userId is required");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) {
    throw new Error(`User ${userId} not found or has no email`);
  }

  await emailService.send({
    to: user.email,
    subject: "Welcome to Quark",
    html: "<p>Welcome!</p>"
  });

  logger.info(`Welcome email sent to ${user.email}`);
  return { success: true, email: user.email };
}
```

### Handler Signature

Every job handler receives:

```typescript
async function jobHandler(
  bullJob: {
    id: string;          // Unique job ID
    name: string;        // Job type (e.g., "send-welcome-email")
    data: Object;        // Payload from queue.add()
    attemptsMade: number;// Number of retry attempts
  },
  logger: {
    info: Function;
    warn: Function;
    error: Function;
  }
): Promise<any> {
  // Return: Success result (serializable)
  // Throw: Error (triggers retry or failure)
}
```

### Error Handling in Handlers

```javascript
export async function handleCleanupFiles(bullJob, logger) {
  const retentionHours = bullJob.data?.retentionHours || 24;
  
  logger.info("Starting cleanup", { retentionHours });

  const orphaned = await prisma.file.findMany(where: {
    createdAt: { lt: cutoffDate }
  });

  let deleted = 0;
  const errors = [];

  for (const file of orphaned) {
    try {
      await storage.delete(file.storageKey);
      await prisma.file.delete({ where: { id: file.id } });
      deleted++;
    } catch (err) {
      // Continue processing others, log failures
      errors.push({ fileId: file.id, error: err.message });
      logger.warn(`Failed to delete file ${file.id}`, { error: err.message });
    }
  }

  return {
    success: errors.length < orphaned.length,
    deleted,
    total: orphaned.length,
    errors
  };
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

Suppresses repeated errors within a time window:

```javascript
import { throttledError } from "./index.js";

test("throttledError suppresses duplicate errors within window", async () => {
  const logger = createMockLogger();
  const throttle = throttledError(logger, 100); // 100ms window

  // First error logs
  throttle(new Error("Redis unavailable"));
  assert.strictEqual(logger.error.mock.callCount(), 1);

  // Second error within window suppressed
  throttle(new Error("Redis unavailable"));
  assert.strictEqual(logger.error.mock.callCount(), 1);

  // After window, error logs again
  await new Promise(r => setTimeout(r, 150));
  throttle(new Error("Redis unavailable"));
  assert.strictEqual(logger.error.mock.callCount(), 2);
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
    image: node:20-alpine
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
process.on("SIGTERM", async () => {
  logger.info("Graceful shutdown initiated");
  
  // 1. Stop accepting new jobs
  for (const worker of workers) {
    await worker.close();
  }
  
  // 2. Wait for in-flight jobs (up to 30s)
  // 3. Disconnect database
  // 4. Exit cleanly
  
  process.exit(0);
});
```

**Important**: Configure your orchestrator to wait at least 40 seconds before force-killing the container:

```yaml
# Kubernetes
terminationGracePeriodSeconds: 40

# Docker Compose
stop_grace_period: 40s
```

## Architectural Patterns

### Error Handling Strategy

The worker uses a **fault-tolerant error handling** approach:

1. **Job-Level Errors**: Failures inside handlers trigger retries with exponential backoff
2. **Connection Errors**: Temporary network issues don't crash the process, they're throttled
3. **Permanent Failures**: After max retries, jobs move to dead-letter queue
4. **Process-Level Errors**: Unhandled errors exit the process (expect orchestrator restart)

### State Management

Workers maintain minimal state:

```javascript
// Global state (kept to a minimum)
const workers = [];        // Active queue workers
let isShuttingDown = false; // Graceful shutdown flag
let connectionErrors = 0;  // Failure tracking for circuit breaker

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

The shutdown sequence ensures no job data loss:

```javascript
// Signal received (SIGTERM from orchestrator)
process.on("SIGTERM", () => {
  // 1. Stop accepting new jobs
  isShuttingDown = true;
  for (const worker of workers) {
    await worker.close();
  }

  // 2. In-flight jobs are allowed to finish (up to WORKER_SHUTDOWN_TIMEOUT_MS)
  // BullMQ will wait for handlers to return/throw

  // 3. Close database connection
  await prisma.$disconnect();

  // 4. Exit
  process.exit(0);
});
```

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
  import { createQueue } from '@techstream/quark-core';
  const q = createQueue('emails');
  const job = await q.add('send-welcome-email', { userId: 'test-1' });
  console.log('Job enqueued:', job.id);
"
```

### Debugging Tips

**Enable verbose logging**: Set `DEBUG=*` environment variable

```bash
DEBUG=* pnpm dev
```

**Inspect job state**: Use Prisma Studio to see job records

```bash
pnpm db:studio
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
- **Timeouts**: Default 30s per job. BullMQ will timeout long-running jobs
- **Database Connections**: Worker reuses a single Prisma client across all jobs

If you need horizontal scaling:

```bash
# Each worker process is independent
# Deploy multiple instances; they'll auto-divide work via Redis

# Example: 3 workers on same Redis
NODE_INSTANCE_ID=1 pnpm dev
NODE_INSTANCE_ID=2 pnpm dev
NODE_INSTANCE_ID=3 pnpm dev
```

## Complete Example: Send Email Job

Here's a full example combining all patterns:

**Job Handler** (`src/handlers/email.js`):

```javascript
import { emailService } from "@techstream/quark-core";
import { prisma } from "@techstream/quark-db";

export async function handleSendWelcomeEmail(bullJob, logger) {
  const { userId } = bullJob.data;
  const startTime = Date.now();

  try {
    // Validate input
    if (!userId) {
      throw new Error("userId is required");
    }

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    });

    if (!user?.email) {
      throw new Error(`User ${userId} not found or has no email`);
    }

    // Send email
    await emailService.send({
      to: user.email,
      template: "welcome",
      subject: "Welcome!",
      variables: { name: user.name }
    });

    const duration = Date.now() - startTime;
    logger.info(`Welcome email sent to ${user.email}`, {
      userId,
      duration,
      jobId: bullJob.id
    });

    return { success: true, email: user.email };
  } catch (error) {
    logger.error(`Failed to send welcome email`, {
      userId,
      error: error.message,
      jobId: bullJob.id,
      attempt: bullJob.attemptsMade
    });
    throw error; // Let BullMQ retry
  }
}
```

**Test** (`src/handlers/email.test.js`):

```javascript
import assert from "node:assert";
import { test } from "node:test";
import { handleSendWelcomeEmail } from "./email.js";

test("handleSendWelcomeEmail sends email to valid user", async () => {
  const mockLogger = { info: () => {}, error: () => {} };
  const job = {
    id: "job-1",
    data: { userId: "user-123" },
    attemptsMade: 0
  };

  const result = await handleSendWelcomeEmail(job, mockLogger);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.email, "user@example.com");
});

test("handleSendWelcomeEmail throws on missing userId", async () => {
  const mockLogger = { info: () => {}, error: () => {} };
  const job = {
    id: "job-1",
    data: {},
    attemptsMade: 0
  };

  await assert.rejects(
    () => handleSendWelcomeEmail(job, mockLogger),
    { message: "userId is required" }
  );
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
A: 1. Define in `@techstream/quark-jobs`
2. Implement handler in `src/handlers/`
3. Register in `src/handlers/index.js`
4. Test with `src/handlers/*.test.js`

## Further Reading

- [QUARK_USAGE.md](../docs/QUARK_USAGE.md) - Framework guidelines
- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - Core-only registry model
- [DATABASE.md](../docs/DATABASE.md) - Prisma setup and patterns
- [BullMQ Docs](https://docs.bullmq.io) - Job queue internals
