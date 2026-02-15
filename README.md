# Quark

> A full-stack JavaScript framework with centralized infrastructure updates and local business logic control.

## Overview

Quark is a **Core-Only Registry** framework that provides:
- **Centralized infrastructure** via `@techstream/quark-core` (auth, queues, validation, errors)
- **Local business logic** (database schema, UI components, job handlers)
- **Zero-config scaffolding** via `@techstream/quark-create-app`
- **Monorepo structure** with Turborepo, Next.js 16, Prisma 7, and BullMQ

---

## Quick Start

All Quark packages are published on **npmjs.org** — no authentication required.

### 1. Create a project

```bash
npx @techstream/quark-create-app@latest my-project
```

The CLI will:
- Scaffold the project
- Generate secure `.env` secrets automatically
- Run `pnpm install`

### 2. Run development

```bash
cd my-project
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

🎉 **Open http://localhost:3000**

---

## Security Features

Quark includes production-ready security features:

- 🔒 **CSRF Protection** - Token-based protection for state-changing requests
- 🚦 **Rate Limiting** - In-memory (dev) & Redis-based (production)
- 📏 **Request Size Limits** - Configurable payload restrictions (2MB API, 10MB uploads)
- 🛡️ **Security Headers** - HSTS, X-Frame-Options, CSP, X-XSS-Protection
- 🌐 **CORS** - Environment-based origin control
- 🔐 **Bcrypt** - Password hashing with 12 rounds
- ✅ **Zod** - Input validation on all endpoints

📖 **Read more**: [Security Guide](./docs/SECURITY.md)

---

## Using Quark Packages (CLI and Local Packages)

Quark ships infrastructure through the registry and keeps business logic local:

- **Registry:** `@techstream/quark-core` (auth, queues, validation, errors)
- **Local packages:** `packages/db`, `packages/ui`, `packages/jobs`, `packages/config`

Example usage in your app:

```javascript
import { authOptions } from "@techstream/quark-core";
import { prisma } from "@yourapp/db";
```

To update infrastructure in a project:

```bash
pnpm update @techstream/quark-core
```

---

## Maintainers

```bash
cp .env.example .env

# Install dependencies
pnpm install

docker compose up -d
pnpm db:generate
pnpm dev
```

## Development

- **Linting**: `pnpm lint`
- **Testing**: `pnpm test`
- **Building**: `pnpm build`

### Publishing Updates

When you update the framework:

```bash
# Publish core infrastructure
cd packages/core
npm version patch  # or minor/major
npm publish

# Publish CLI
cd packages/cli
npm version patch
npm publish
```

> **Note:** Both the CLI and `quark-core` publish to **npmjs.org** (public, no auth to install).

Projects get core updates via `pnpm update @techstream/quark-core`.

## Documentation

- **[Documentation Index](./docs/INDEX.md)** - Start here to navigate all documentation
- **[Developer Guide](./copilot-instructions.md)** - Setup, conventions, and workflows
- **[Architecture](./docs/ARCHITECTURE.md)** - Core design patterns and inheritance model
- **[API Reference](./docs/API.md)** - API documentation and endpoints
- **[Security Guide](./docs/SECURITY.md)** - Security features, checklists, and incident response
- **[Usage Guide](./docs/QUARK_USAGE.md)** - Full development and CLI workflow
- **[Maintainability Guide](./docs/MAINTAINABILITY.md)** - Code style and best practices
- **[Roadmap](./docs/ROADMAP.md)** - Long-term vision and strategic direction
