# Quark Architecture: Core-Only Registry Model

This document explains Quark's distribution architecture and the philosophy behind what gets published to the registry versus what gets scaffolded locally.

## The Problem We're Solving

Traditional web frameworks force a choice:
- **Framework-as-dependency**: Get updates but lose control (Next.js, Rails)
- **Boilerplate generators**: Full control but no updates (Create React App ejected, Rails new)

Quark takes a hybrid approach:

- **Core infrastructure comes from registry** - Centralized updates for auth, queues, validation
- **Business logic scaffolds locally** - Full control over database, jobs, UI
- **Update what you need** - Infrastructure gets updates, domain logic stays yours

## The Distribution Model

```
┌─────────────────────────────────────────────────────┐
│  Your Application (@yourapp/web, @yourapp/worker)   │
│  ├─ imports @techstream/quark-core (from registry)   │
│  └─ imports @yourapp/db, @yourapp/jobs (local)      │
├─────────────────────────────────────────────────────┤
│  @techstream/quark-core (npmjs.org)                  │
│  - createAuthConfig()                               │
│  - createQueue(), createWorker()                    │
│  - AppError, ValidationError                        │
│  - validateBody(), validateParams()                 │
│  ❌ No database client (no Prisma)                  │
│  ❌ No domain-specific logic                        │
├─────────────────────────────────────────────────────┤
│  @yourapp/db (Local - Always Scaffolded)            │
│  - schema.prisma (YOUR models)                      │
│  - PrismaClient instantiation                       │
│  - Query builders for your domain                   │
├─────────────────────────────────────────────────────┤
│  @yourapp/ui (Local - Optional)                     │
│  @yourapp/jobs (Local - Optional)                   │
│  @yourapp/config (Local - Optional)                 │
├─────────────────────────────────────────────────────┤
│  Infrastructure Packages (npm)                      │
│  - @prisma/client, BullMQ, next-auth, etc.          │
└─────────────────────────────────────────────────────┘
```

## What Lives in Core (Registry)

✅ **Infrastructure-Level Utilities**
- next-auth initialization helpers
- BullMQ queue factory
- Standardized error types
- Common utility functions (password hashing, etc.)

✅ **Provider-Agnostic Patterns**
- Error handling conventions
- Validation middleware
- Job queue abstractions

✅ **Type Definitions**
- JSDoc for IDE support
- Common interfaces

❌ **Database Client** (moved to local `@yourapp/db`)
- Prisma schema is always customized per app
- Client instantiation requires app-specific connection config

❌ **Domain-Specific Logic**
- Your business models
- Your API endpoints
- Your UI components
- Your job handlers

❌ **Application Configuration**
- Environment-specific settings
- Deployment configurations
- Feature flags
- App-specific providers

## Why This Split?

### Core Infrastructure → Registry

**Auth, queues, validation rarely need customization:**
- Most apps use BullMQ the same way
- `createAuthConfig()` defaults work for 90% of cases
- Error types (`AppError`, `ValidationError`) are universal

**Benefits of registry distribution:**
- Bug fixes propagate instantly (`pnpm update`)
- Security patches reach all projects
- API improvements available immediately

### Database, Jobs, UI → Local Scaffolds

**Every app has unique domain models:**
- E-commerce needs `Product`, `Order`, `Cart`
- SaaS needs `Organization`, `Subscription`, `Invoice`
- Prisma schema is the most customized file in any project

**Jobs are domain-specific:**
- One app sends transactional emails
- Another processes video uploads
- Job handlers contain business logic, not infrastructure

**UI is inherently custom:**
- Design systems differ per brand
- Component APIs match product needs
- Shared components evolve with features

**Benefits of local scaffolding:**
- Full git history of domain changes
- No conflicts with central updates
- Freedom to refactor business logic

## Examples: Registry vs. Local

### Example 1: Authentication

**In Core (Registry):**
```javascript
// @techstream/quark-core - Provides defaults
import { createAuthConfig } from "@techstream/quark-core";

export const createAuthConfig = (options = {}) => {
  return {
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    callbacks: { /* default callbacks */ },
    ...options // Allow extensions
  };
};
```

**In Your App (Local):**
```javascript
// apps/web/lib/auth.js - Your customizations
import { createAuthConfig } from "@techstream/quark-core";
import GitHubProvider from "next-auth/providers/github";

export const authConfig = createAuthConfig({
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role; // Custom field
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      return session;
    },
  },
});
```

### Example 2: Database Client

**Before (Old Architecture - Circular Dependency):**
```javascript
// ❌ REMOVED: Core had database client
// @techstream/quark-core/src/db/index.js
export const createDbClient = () => {
  // Problem: Core depended on @techstream/quark-db
  // But db depended on core → circular!
};
```

**Now (Core-Only Registry - Clean):**
```javascript
// ✅ Core has NO database code
// @techstream/quark-core exports: auth, queues, validation, errors ONLY
```

**In Your Local DB Package:**
```javascript
// packages/db/src/client.js - YOU own this
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

// Build connection string from YOUR environment
const connectionString = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}...`;

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});
```

**Key Points:**
- Core has NO database client (no Prisma dependency)
- Each app creates client based on its own schema
- Your schema.prisma is completely custom

### Example 3: Job Definitions

**In Core (Registry):**
```javascript
// @techstream/quark-core/src/queue/index.js
export const createQueue = (name, options = {}) => {
  return new Queue(name, {
    connection: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    },
    defaultJobOptions: { attempts: 3, ... },
    ...options
  });
};
```

**In Your Local Jobs Package:**
```javascript
// packages/jobs/src/definitions.js - YOUR domain jobs
export const JOB_QUEUES = {
  EMAIL: "email-queue",
  VIDEO_PROCESSING: "video-queue", // Your custom queue
};

export const JOB_NAMES = {
  SEND_WELCOME_EMAIL: "send-welcome-email",
  TRANSCODE_VIDEO: "transcode-video", // Your custom job
};
```

**In Your Worker App:**
```javascript
// apps/worker/src/index.js
import { createQueue, createWorker } from "@techstream/quark-core";
import { JOB_QUEUES, JOB_NAMES } from "@yourapp/jobs";

const videoQueue = createQueue(JOB_QUEUES.VIDEO_PROCESSING, {
  defaultJobOptions: {
    attempts: 2,
    timeout: 300000, // 5 min for video processing
  }
});

const worker = createWorker(
  JOB_QUEUES.VIDEO_PROCESSING,
  async (job) => {
    // YOUR business logic
    if (job.name === JOB_NAMES.TRANSCODE_VIDEO) {
      await transcodeVideo(job.data);
    }
  }
);
```

**Key Points:**
- Core provides queue infrastructure (createQueue, createWorker)
- Your jobs package defines domain-specific queues and job types
- Worker contains your business logic
- No need to rewrite queue setup

### Example 4: Database Client

**In Core:**
```javascript
// @techstream/quark-core/src/db/index.js
export const createDbClient = (options = {}) => {
  const globalForPrisma = globalThis;
  const prisma = globalForPrisma.prisma || new PrismaClient(options);
  
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }
  
  return prisma;
};
```

**In Your App:**
```javascript
// @quark/web/lib/db.js
import { createDbClient } from "@techstream/quark-core";

// Use with defaults - zero configuration!
const db = createDbClient();

// Or customize middleware
const db = createDbClient({
  middleware: [
    {
      $use: async (params, next) => {
        const before = Date.now();
        const result = await next(params);
        const after = Date.now();
        
        // Custom logging
        console.log(`${params.model}.${params.action} took ${after - before}ms`);
        
        return result;
      },
    },
  ],
});
```

**Key Points:**
- Core handles singleton pattern automatically
- Apps get working database with zero setup
- Can add middleware if needed

## Ejection Patterns

### Pattern 1: Selective Override

Use core for some things, replace others:

```javascript
// Keep core auth
import { createAuthConfig } from "@techstream/quark-core";

// Use custom queue setup
import Queue from "bullmq";

const authConfig = createAuthConfig({ providers: [...] });
const customQueue = new Queue("special", { custom: "options" });
```

### Pattern 2: Middleware Injection

Add behavior without changing core:

```javascript
import { createDbClient } from "@techstream/quark-core";

const db = createDbClient({
  middleware: [
    // Add logging
    loggingMiddleware,
    // Add audit trail
    auditMiddleware,
    // Add performance monitoring
    performanceMiddleware,
  ]
});
```

### Pattern 3: Wrapper Functions

Create application-specific wrappers around core:

```javascript
// lib/api-utils.js
import { requireAuth, UnauthorizedError } from "@techstream/quark-core";

export const withAuth = (handler) => {
  return async (req, res) => {
    const session = await getSession({ req });
    const userId = requireAuth(session);
    return handler(userId, req, res);
  };
};

// api/users/profile.js
import { withAuth } from "@/lib/api-utils";

export default withAuth(async (userId, req, res) => {
  const user = await db.user.findUnique({ where: { id: userId } });
  res.json(user);
});
```

### Pattern 4: Extension Classes

Extend core error types:

```javascript
// Extend core error with app context
class AppApiError extends AppError {
  constructor(message, statusCode, code, context = {}) {
    super(message, statusCode, code);
    this.context = context;
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      context: this.context,
    };
  }
}
```

## Migration Guide

### Starting with Core (Recommended)

```bash
# 1. Create new app
pnpm create quark my-app

# 2. Inherit core automatically
import { createDbClient } from "@techstream/quark-core";

# 3. Start using core utilities
const db = createDbClient(); // Works immediately
```

### Migrating Existing App

```javascript
// Before: everything in one file
// app/lib/auth.js
export const config = { providers: [...], ... };

// After: use core, eject what you need
// app/lib/auth.js
import { createAuthConfig } from "@techstream/quark-core";

export const config = createAuthConfig({
  providers: [...],
  callbacks: { /* your custom logic */ }
});
```

## When to Eject

**Eject when you need:**
- Custom authentication providers (GitHub, Google, SAML, etc.)
- Domain-specific errors
- Specialized queue configurations
- Database middleware for logging/auditing
- Application-specific utilities

**Don't eject if:**
- Core provides what you need
- You're trying to replace core entirely
- It's temporary test code

## Best Practices

### 1. Prefer Composition Over Replacement

```javascript
// ✅ Good: Extend core
import { createAuthConfig } from "@techstream/quark-core";

export const authConfig = createAuthConfig({
  providers: [CustomProvider()],
});

// ❌ Avoid: Rewriting from scratch
export const authConfig = {
  providers: [CustomProvider()],
  // ... missing all core defaults
};
```

### 2. Keep Core Portable

Core should work standalone:

```javascript
// ✅ Good: Core works in any app
import { createQueue } from "@techstream/quark-core";
const q = createQueue("jobs");

// ❌ Bad: Core depends on app setup
import { config } from "./config"; // App-specific
import { db } from "./db";         // App-specific
```

### 3. Document Your Ejections

```javascript
// lib/auth.js
/**
 * Authentication config for MyApp
 * 
 * Extends @techstream/quark-core with:
 * - GitHub OAuth provider
 * - Custom role field in JWT
 * - Email domain validation
 */
import { createAuthConfig } from "@techstream/quark-core";

export const authConfig = createAuthConfig({
  // Our customizations here...
});
```

### 4. Test Core Separately

```bash
# Core has its own tests
cd packages/core
pnpm test

# Apps test their ejections
cd apps/web
pnpm test
```

## The Future

As your app grows:

1. **Months 0-3**: Use core mostly unchanged
2. **Months 3-6**: Start ejecting for domain needs
3. **Months 6+**: Contribute improvements back to core

Core evolves based on real usage patterns!

## Resources

- [Core API Reference](./README.md)
- [Core Source Code](./src/)
- [Example Apps](../../apps/)
- [Contributing to Core](../../CONTRIBUTING.md)
