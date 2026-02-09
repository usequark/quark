# Using @quark/core in Your Application

This guide shows how to integrate `@quark/core` into a new or existing Quark application.

## Quick Start

### 1. Installation

Core is automatically included in your `package.json`:

```json
{
  "dependencies": {
    "@quark/core": "workspace:*"
  }
}
```

Install dependencies:
```bash
pnpm install
```

### 2. Database Setup

**In your app's main file:**

```javascript
import { createDbClient } from "@quark/core";

const db = createDbClient();

// Use immediately - no configuration needed!
const user = await db.user.findUnique({ 
  where: { id: "user-123" } 
});
```

**That's it!** The database client is:
- ✅ Singleton in development (prevents hot-reload issues)
- ✅ Properly initialized in production
- ✅ Supports all Prisma options

### 3. Authentication Setup

**Create `lib/auth.js` in your app:**

```javascript
import { createAuthConfig } from "@quark/core";
import GitHubProvider from "next-auth/providers/github";

export const authConfig = createAuthConfig({
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  // Optional: add custom callbacks
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  }
});
```

**In your Next.js API route:**

```javascript
// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth";

const handler = NextAuth(authConfig);
export { handler as GET, handler as POST };
```

**Use in components:**

```javascript
import { getCurrentSession, getUserId } from "@quark/core";
import { getSession } from "next-auth/react";

export default async function ProfilePage() {
  const session = await getCurrentSession(getSession);
  const userId = getUserId(session);
  
  if (!userId) {
    redirect("/login");
  }
  
  const user = await db.user.findUnique({ 
    where: { id: userId } 
  });
  
  return <div>Hello, {user.name}!</div>;
}
```

### 4. Job Queue Setup

**Create `lib/queues.js`:**

```javascript
import { createQueue, createWorker } from "@quark/core";

// Create queues
export const emailQueue = createQueue("emails", {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

export const analyticsQueue = createQueue("analytics");

// Set up workers (in your worker process)
createWorker("emails", async (job) => {
  const { to, subject, html } = job.data;
  await sendEmail({ to, subject, html });
  console.log(`Email sent to ${to}`);
});

createWorker("analytics", async (job) => {
  const { event, userId } = job.data;
  await trackEvent(event, userId);
  console.log(`Event tracked: ${event}`);
});
```

**Use in your app:**

```javascript
import { addJob } from "@quark/core";
import { emailQueue, analyticsQueue } from "@/lib/queues";

// Add a job
await addJob(emailQueue, {
  to: "user@example.com",
  subject: "Welcome!",
  html: "<h1>Hello!</h1>",
});

// Track analytics (fire and forget)
await addJob(analyticsQueue, {
  event: "user_signup",
  userId: user.id,
});
```

### 5. Error Handling

**Use core error types:**

```javascript
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  AppError,
  logError,
} from "@quark/core";

// API endpoint with error handling
export async function POST(request) {
  try {
    const data = await request.json();
    
    if (!data.email) {
      throw new ValidationError("Email is required");
    }
    
    const user = await db.user.findUnique({
      where: { email: data.email },
    });
    
    if (!user) {
      throw new NotFoundError("User not found");
    }
    
    return Response.json(user);
    
  } catch (error) {
    logError(error, { endpoint: "POST /api/users" });
    
    // Return proper status code
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return Response.json(error.toJSON(), { status: statusCode });
  }
}
```

### 6. Utilities

**Use common helpers:**

```javascript
import {
  retryAsync,
  validateEnv,
  sleep,
  sanitizeId,
  randomString,
  memoize,
} from "@quark/core";

// Validate environment on startup
validateEnv(["DATABASE_URL", "REDIS_HOST", "GITHUB_ID"]);

// Retry external API calls
const data = await retryAsync(
  () => fetchFromExternalAPI(),
  { maxAttempts: 3, initialDelay: 1000 }
);

// Generate safe IDs
const sessionId = randomString(32);

// Cache database queries
const getCachedUser = memoize(
  (id) => db.user.findUnique({ where: { id } }),
  60000 // 1 minute cache
);
```

## Configuration

### Environment Variables

Set these in your `.env`:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/quark

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Authentication
NEXTAUTH_SECRET=your-random-secret-key
NEXTAUTH_URL=http://localhost:3000

# OAuth Providers (if using)
GITHUB_ID=your-github-id
GITHUB_SECRET=your-github-secret
```

### Docker Compose

A `docker-compose.yml` provides PostgreSQL and Redis:

```bash
docker-compose up -d
```

## Advanced Usage

### Customize Database Middleware

```javascript
import { createDbClient } from "@quark/core";

const db = createDbClient({
  middleware: [
    {
      $use: async (params, next) => {
        // Log all queries in development
        if (process.env.NODE_ENV === "development") {
          console.log(`[Prisma] ${params.model}.${params.action}`);
        }
        
        return next(params);
      },
    },
    {
      $use: async (params, next) => {
        // Add audit logging
        if (["create", "update", "delete"].includes(params.action)) {
          await logAudit({
            model: params.model,
            action: params.action,
            data: params.args,
            timestamp: new Date(),
          });
        }
        
        return next(params);
      },
    },
  ],
});
```

### Custom Error Types

```javascript
import { AppError } from "@quark/core";

export class PaymentError extends AppError {
  constructor(message, provider, code = "PAYMENT_ERROR") {
    super(message, 402, code);
    this.provider = provider;
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      provider: this.provider,
    };
  }
}

// Use in your API
throw new PaymentError(
  "Payment processing failed",
  "Stripe"
);
```

### Health Checks

```javascript
import { checkQueueHealth } from "@quark/core";

export async function GET() {
  const queueHealthy = await checkQueueHealth();
  
  return Response.json({
    status: queueHealthy ? "healthy" : "degraded",
    checks: {
      database: "ok", // Add your own checks
      redis: queueHealthy ? "ok" : "error",
    },
  });
}
```

## Troubleshooting

### "Cannot find Prisma Client"

```bash
# Generate Prisma client
pnpm db:generate

# Or if using the db package
cd packages/db
pnpm db:generate
```

### "Redis connection refused"

```bash
# Start Redis
docker-compose up -d redis

# Or check your REDIS_HOST/REDIS_PORT
echo $REDIS_HOST
echo $REDIS_PORT
```

### "NEXTAUTH_SECRET is not set"

In **production**, set the environment variable:

```bash
export NEXTAUTH_SECRET="$(openssl rand -hex 32)"
```

In **development**, create a `.env.local`:

```bash
NEXTAUTH_SECRET=dev-secret-key
```

### Prisma schema not found

Ensure your Prisma schema is in the right place:

```
packages/db/prisma/schema.prisma  ← Shared schema
```

If you have a separate schema, update `DATABASE_URL` in `.env` and run migrations.

## Testing

### Test Core Features

Core includes comprehensive tests:

```bash
cd packages/core
pnpm test
```

### Test Your Integration

```javascript
// lib/__tests__/auth.test.js
import { test } from "node:test";
import { authConfig } from "@/lib/auth";

test("authConfig is properly configured", () => {
  assert(authConfig.providers.length > 0);
  assert(authConfig.session.strategy === "jwt");
});
```

## Next Steps

1. **Explore examples** in [Core README](./README.md)
2. **Learn architecture** in [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Read API docs** for each module
4. **Check out example apps** in `/apps/`

## Getting Help

- 📖 [Core API Documentation](./README.md)
- 🏗️ [Architecture Guide](./ARCHITECTURE.md)
- 💬 [GitHub Discussions](https://github.com/quark/discussions)
- 🐛 [Report Issues](https://github.com/quark/issues)
