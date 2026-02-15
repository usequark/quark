```instructions
# Quark Monorepo - Developer Guide

## Quick Setup

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, Mailhog)
docker compose up -d

# Generate Prisma client
pnpm db:generate

# Run development servers
pnpm dev
```

## Project Structure

```
quark/
├── apps/
│   ├── web/          # Next.js 16 (React 19)
│   └── worker/       # BullMQ background worker
├── packages/
│   ├── core/         # Shared utilities (DB, Auth, Queue, Errors)
│   ├── db/           # Prisma schema and queries
│   ├── jobs/         # Job queue definitions
│   ├── ui/           # Shared UI components
│   ├── config/       # Shared configuration
│   └── cli/          # Project scaffolding tool
└── docs/             # Documentation
```

## Tech Stack

- **Runtime:** Node.js (ESM only)
- **Language:** JavaScript (no TypeScript)
- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL + Prisma
- **Cache/Queue:** Redis + BullMQ
- **Testing:** Node.js native `node:test`
- **Linting:** Biome (single config)
- **Monorepo:** Turborepo + pnpm

## Common Commands

```bash
# Development
pnpm dev              # Run all apps in dev mode
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all code

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema changes
pnpm db:seed          # Seed test data

# Create new project (from CLI)
pnpm new my-app       # Scaffold new Quark project
```

## Conventions

### Code Style
- Pure ESM modules (`import`/`export` only)
- Files use `.js` and `.jsx` extensions
- Tests live next to sources: `*.test.js`
- Biome for all formatting/linting

### Package Structure
```
packages/example/
├── package.json
├── src/
│   ├── index.js       # Public API exports
│   ├── feature.js     # Implementation
│   └── feature.test.js # Tests
└── coverage/          # Test coverage reports
```

### Import Guidelines
```javascript
// ✅ Use package public API
import { Button } from "@techstream/quark-ui";
import { prisma, user } from "@techstream/quark-db";

// ❌ No deep imports
import { Button } from "@techstream/quark-ui/src/button";
```

## Core Package (@techstream/quark-core)

Provides infrastructure utilities for all apps:

```javascript
// Database (from local package, not core)
import { prisma, user, post, session } from "@techstream/quark-db";

// Authentication
import { createAuthConfig, getCurrentSession } from "@techstream/quark-core";

// Job Queue
import { createQueue, createWorker, addJob } from "@techstream/quark-core";

// Error Handling
import { ValidationError, UnauthorizedError, NotFoundError } from "@techstream/quark-core";

// Utilities
import { retryAsync, validateEnv, sanitizeId } from "@techstream/quark-core";
```

## Testing

Use Node.js built-in test runner:

```javascript
import { test } from "node:test";
import assert from "node:assert";

test("example test", () => {
  assert.strictEqual(1 + 1, 2);
});
```

Run tests: `pnpm test`

## Environment Variables

Create `.env` from `.env.example`:

```bash
DATABASE_URL=postgresql://quark:development@localhost:5432/quark_dev
REDIS_URL=redis://localhost:6379
APP_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
```

Generate secret: `openssl rand -base64 32`

## Documentation

- **[/docs/INDEX.md](./docs/INDEX.md)** - Documentation navigation
- **[/docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Design patterns
- **[/docs/API.md](./docs/API.md)** - API reference
- **[/docs/MAINTAINABILITY.md](./docs/MAINTAINABILITY.md)** - Code guidelines
- **[/docs/ROADMAP.md](./docs/ROADMAP.md)** - Future plans
- **[packages/cli/README.md](./packages/cli/README.md)** - CLI tool guide
- **[packages/core/README.md](./packages/core/README.md)** - Core utilities API

## Troubleshooting

**Prisma client not found:**
```bash
pnpm db:generate
```

**Port conflicts:**
```bash
lsof -i :3000        # Check what's using port
docker compose down  # Stop all services
```

**Redis connection issues:**
```bash
docker compose up -d redis
```

**Tests failing:**
```bash
pnpm test -- --watch  # Watch mode for specific test
```

```

