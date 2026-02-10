# Core vs. Ejected: The Quark Inheritance Pattern

This document explains the philosophy behind `@Bobnoddle/quark-core` and how applications inherit, customize, and "eject" from core infrastructure.

## The Problem We're Solving

Traditional web frameworks often lock you into their patterns. Quark takes a different approach:

- **Core provides sensible defaults** - Zero configuration needed to start
- **Apps can inherit and extend** - Customize without forking
- **Eject when needed** - Take full control of any layer

## The Inheritance Model

```
┌─────────────────────────────────────────────────────┐
│  Your Application (@quark/web, @quark/api, etc.)    │
├─────────────────────────────────────────────────────┤
│  Ejected/Custom Layer (optional overrides)          │
│  - Custom auth config, error handlers, etc.         │
├─────────────────────────────────────────────────────┤
│  @Bobnoddle/quark-core - The Plumbing                         │
│  - Database client factory                          │
│  - Auth initialization                              │
│  - Job queue wrapper                                │
│  - Error types                                      │
│  - Common utilities                                 │
├─────────────────────────────────────────────────────┤
│  Infrastructure Packages (@prisma/client, BullMQ, etc.) │
└─────────────────────────────────────────────────────┘
```

## What Lives in Core

✅ **Infrastructure-Level Utilities**
- Prisma client factory
- next-auth initialization helpers
- BullMQ queue factory
- Standardized error types
- Common utility functions

✅ **Provider-Agnostic Patterns**
- Error handling conventions
- Session management helpers
- Database client patterns
- Job queue abstractions

✅ **Type Definitions**
- JSDoc for IDE support
- TypeScript definitions
- Common interfaces

❌ **Domain-Specific Logic**
- Your business models
- Your API endpoints
- Your UI components
- Your authentication providers

❌ **Application Configuration**
- Environment-specific settings
- Deployment configurations
- Feature flags
- App-specific providers

## Examples: Core vs. Ejected

### Example 1: Authentication

**In Core:**
```javascript
// @Bobnoddle/quark-core - Provides defaults
import { createAuthConfig } from "@Bobnoddle/quark-core";

export const createAuthConfig = (options = {}) => {
  return {
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    callbacks: { /* default callbacks */ },
    ...options // Allow extensions
  };
};
```

**Ejected in Your App:**
```javascript
// @quark/web/lib/auth.js - Your customizations
import { createAuthConfig } from "@Bobnoddle/quark-core";
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

**Key Points:**
- Core provides the foundation
- App extends with providers and custom logic
- Custom callbacks are additive, not replacing

### Example 2: Error Handling

**In Core:**
```javascript
// @Bobnoddle/quark-core/src/errors.js
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, "VALIDATION_ERROR");
    this.details = details;
  }
}
```

**Optionally Ejected in Your App:**
```javascript
// @quark/web/lib/errors.js - Custom domain errors
import { AppError } from "@Bobnoddle/quark-core";

export class PaymentError extends AppError {
  constructor(message, code = "PAYMENT_FAILED", provider) {
    super(message, 402, code);
    this.provider = provider; // Custom property
  }
}

// Use both Core and Custom errors
import { ValidationError, NotFoundError } from "@Bobnoddle/quark-core";
import { PaymentError } from "./errors.js";
```

**Key Points:**
- Core provides base error types
- Extend them for domain-specific needs
- Both types are serializable

### Example 3: Job Queue

**In Core:**
```javascript
// @Bobnoddle/quark-core/src/queue/index.js
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

**In Your Worker App:**
```javascript
// @quark/worker/src/queues.js
import { createQueue, createWorker } from "@Bobnoddle/quark-core";

// Inherit defaults but customize for this app
export const emailQueue = createQueue("emails", {
  defaultJobOptions: {
    attempts: 5, // More retries for emails
    backoff: { type: "fixed", delay: 5000 },
  }
});

export const emailWorker = createWorker(
  "emails",
  async (job) => {
    await sendEmail(job.data);
  },
  { concurrency: 10 } // Custom concurrency
);
```

**Key Points:**
- Core provides factory with smart defaults
- Apps customize specific values
- No need to rewrite queue setup

### Example 4: Database Client

**In Core:**
```javascript
// @Bobnoddle/quark-core/src/db/index.js
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
import { createDbClient } from "@Bobnoddle/quark-core";

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
import { createAuthConfig } from "@Bobnoddle/quark-core";

// Use custom queue setup
import Queue from "bullmq";

const authConfig = createAuthConfig({ providers: [...] });
const customQueue = new Queue("special", { custom: "options" });
```

### Pattern 2: Middleware Injection

Add behavior without changing core:

```javascript
import { createDbClient } from "@Bobnoddle/quark-core";

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
import { requireAuth, UnauthorizedError } from "@Bobnoddle/quark-core";

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
import { createDbClient } from "@Bobnoddle/quark-core";

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
import { createAuthConfig } from "@Bobnoddle/quark-core";

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
import { createAuthConfig } from "@Bobnoddle/quark-core";

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
import { createQueue } from "@Bobnoddle/quark-core";
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
 * Extends @Bobnoddle/quark-core with:
 * - GitHub OAuth provider
 * - Custom role field in JWT
 * - Email domain validation
 */
import { createAuthConfig } from "@Bobnoddle/quark-core";

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
