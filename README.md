<p align="center">
  <img src=".github/assets/quark_no_text_cropped.png" alt="Quark" width="200" />
</p>

<h1 align="center">Quark</h1>

<p align="center">
  A full-stack JavaScript framework with centralized infrastructure updates. 
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@techstream/quark-core"><img src="https://img.shields.io/npm/v/@techstream/quark-core?label=quark-core" alt="npm quark-core" /></a>
  <a href="https://www.npmjs.com/package/@techstream/quark-create-app"><img src="https://img.shields.io/npm/v/@techstream/quark-create-app?label=create-app" alt="npm create-app" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-ISC-blue.svg" alt="License" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-24-brightgreen" alt="Node.js" /></a>
  <a href="https://pnpm.io"><img src="https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white" alt="pnpm" /></a>
</p>

---

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

**Database:** Quark provides core models (User, Account, Session, VerificationToken, Job, File, AuditLog) but **does not include domain models**. You define your own: products (ecommerce), posts (CMS), contact forms (brochure sites), workspaces (SaaS), etc.

📖 **See [Domain Model Examples](./docs/EXAMPLES.md)** for reference patterns (blog posts, products, contact forms, workspaces)

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

This project uses [Changesets](https://github.com/changesets/changesets) for automated versioning, changelogs, and npm publishing.

#### Adding a changeset

After making changes to publishable packages (`@techstream/quark-core`, `@techstream/quark-create-app`):

```bash
pnpm changeset
```

This creates a `.changeset/<hash>.md` file describing the change and bump type (patch/minor/major). Commit it with your code.

#### Release flow

1. Push to `main` with a changeset → the Release workflow opens a **"Version Packages"** PR that bumps versions and updates `CHANGELOG.md`
2. Merge the PR → packages are published to npm, git tags and GitHub Releases are created automatically

#### No-release changes

For changes that don't need a release (docs, CI, tests):

```bash
pnpm changeset --empty
```

#### Available scripts

- `pnpm changeset` — add a changeset
- `pnpm version-packages` — bump versions & update changelogs (local)
- `pnpm release` — publish changed packages to npm (local)

> **Note:** Publishing is handled automatically by CI. The local scripts are for debugging only.

## Documentation

- **[Documentation Index](./docs/INDEX.md)** - Start here to navigate all documentation
- **[Developer Guide](./copilot-instructions.md)** - Setup, conventions, and workflows
- **[Architecture](./docs/ARCHITECTURE.md)** - Core design patterns and inheritance model
- **[API Reference](./docs/API.md)** - API documentation and endpoints
- **[Security Guide](./docs/SECURITY.md)** - Security features, checklists, and incident response
- **[Usage Guide](./docs/QUARK_USAGE.md)** - Full development and CLI workflow
- **[Maintainability Guide](./docs/MAINTAINABILITY.md)** - Code style and best practices
- **[Roadmap](./docs/ROADMAP.md)** - Long-term vision and strategic direction
