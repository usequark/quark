# Quark

> A full-stack TypeScript framework with centralized infrastructure updates and local business logic control.

## Overview

Quark is a **Core-Only Registry** framework that provides:
- **Centralized infrastructure** via `@bobnoddle/quark-core` (auth, queues, validation, errors)
- **Local business logic** (database schema, UI components, job handlers)
- **Zero-config scaffolding** via `@bobnoddle/quark-create-app`
- **Monorepo structure** with Turborepo, Next.js 16, Prisma 7, and BullMQ

---

## Quick Start

The CLI (`@bobnoddle/quark-create-app`) is published on **npmjs.org** — no auth needed.  
`@bobnoddle/quark-core` is on **GitHub Packages** and requires a GitHub PAT during install.

### 1. Create a project

```bash
# No login or token required — the CLI is on the public npm registry
npx @bobnoddle/quark-create-app@latest my-project
```

The CLI will:
- Scaffold the project
- Prompt you for a GitHub PAT (with `read:packages` scope)
- Create `.env` (with your token as `GH_TOKEN`) and `.npmrc` automatically

> **Need a token?** Go to https://github.com/settings/tokens → Generate new token (classic) → select **`read:packages`** → copy the token (starts with `ghp_`).

### 2. Install dependencies

```bash
cd my-project
npx dotenv-cli -e .env -- pnpm install
```

### 3. Run development

```bash
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

- **Registry:** `@bobnoddle/quark-core` (auth, queues, validation, errors)
- **Local packages:** `packages/db`, `packages/ui`, `packages/jobs`, `packages/config`

Example usage in your app:

```javascript
import { authOptions } from "@bobnoddle/quark-core";
import { prisma } from "@yourapp/db";
```

To update infrastructure in a project:

```bash
pnpm update @bobnoddle/quark-core
```

---

## Maintainers

```bash
cp .env.example .env
# Add GH_TOKEN to .env (repo-local)

# Install dependencies (cross-platform)
npx dotenv-cli -e .env -- pnpm install

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
# Publish core infrastructure (GitHub Packages)
cd packages/core
npm version patch  # or minor/major
npm publish

# Publish CLI (npmjs.org — different registry)
cd packages/cli
npm version patch
npm publish  # publishConfig in package.json targets npmjs.org
```

> **Note:** The CLI publishes to **npmjs.org** (public, no auth to install).  
> `quark-core` publishes to **GitHub Packages** (requires PAT to install).

Employee projects will get core updates via `pnpm update @bobnoddle/quark-core`.

## Documentation

- **[Documentation Index](./docs/INDEX.md)** - Start here to navigate all documentation
- **[Developer Guide](./copilot-instructions.md)** - Setup, conventions, and workflows
- **[Architecture](./docs/ARCHITECTURE.md)** - Core design patterns and inheritance model
- **[API Reference](./docs/API.md)** - API documentation and endpoints
- **[Security Guide](./docs/SECURITY.md)** - Security features, checklists, and incident response
- **[Usage Guide](./docs/QUARK_USAGE.md)** - Full development and CLI workflow
- **[Maintainability Guide](./docs/MAINTAINABILITY.md)** - Code style and best practices
- **[Roadmap](./docs/ROADMAP.md)** - Long-term vision and strategic direction
