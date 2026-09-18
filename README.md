<p align="center">
  <img src=".github/assets/quark.svg" alt="Quark" width="200" />
</p>

<h1 align="center">Quark</h1>

<p align="center">
  A full-stack JavaScript framework with centralized infrastructure updates. 
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@techstream/quark-core"><img src="https://img.shields.io/npm/v/@techstream/quark-core?label=Quark%20Core" alt="Quark Core version" /></a>
  &nbsp;
  <a href="https://www.npmjs.com/package/@techstream/quark-create-app"><img src="https://img.shields.io/npm/v/@techstream/quark-create-app?label=Quark%20Create" alt="Quark Create version" /></a>
  &nbsp;
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-22-brightgreen?logo=node.js&logoColor=white" alt="Node.js 22" /></a>
  &nbsp;
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  &nbsp;
  <a href="https://www.prisma.io"><img src="https://img.shields.io/badge/Prisma-7-4B60E2?logo=prisma&logoColor=white" alt="Prisma 7" /></a>
  &nbsp;
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-ISC-blue.svg" alt="License" /></a>
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

All Quark packages are published on **npmjs.org** - no authentication required.

### 1. Create a project

```bash
npx @techstream/quark-create-app@latest my-project
```

The CLI will:
- Scaffold the project
- Generate secure `.env` secrets automatically
- Run `pnpm install`

**CLI Options:**

| Flag | Description |
|------|-------------|
| `--packages ui,jobs` | Include optional packages (ui, jobs) |
| `--preset <name>` | Use a preset bundle (client-work, internal-tool, product, minimal) |
| `--signup enabled\|disabled` | Control public self-service signup |
| `--skip-install` | Skip pnpm install and Prisma generate |
| `--prompt "brief"` | Set the product brief for MAIN.md |

Providing any config option automatically skips interactive prompts.

### 2. Run development

```bash
cd my-project
docker compose up -d
pnpm db:migrate
pnpm dev
```

🎉 **Open http://localhost:3000**

### Deployment note

Quark's generated web app uses a Next.js standalone deploy path for container platforms. For Docker, Railway, and other self-hosted container deployments, the web process must bind `HOSTNAME=0.0.0.0` so it listens on the container interface instead of `localhost`.

Scaffolded projects already include this in the generated web Dockerfile, `.railway/railway.ts`, and `.env.railway.example`. If a deploy starts but is unreachable externally, check `HOSTNAME` first and let the platform provide `PORT`.

---

## Start Here

- **[Start Here](./docs/START_HERE.md)** - the current onboarding path for creating, running, and learning a Quark project
- **[First Feature Guide](./docs/FIRST_FEATURE.md)** - add your first domain model, query helper, and page without reverse-engineering the scaffold
- **[Documentation Index](./docs/INDEX.md)** - the full map of reference docs, feature guides, and planning docs

## UI References

- **[Public example page](./apps/web/src/app/example-page/page.js)** - the production-style public route built from the shared UI package
- **[UI package README](./packages/ui/README.md)** - the supported component surface and props
- **[Playground route](./apps/web/src/app/playground/page.js)** - the full component reference page inside the reference app

---

## What Quark Gives You

**Always scaffolded:** `db` (Prisma), `config` (env validation), `ui` (Tailwind primitives)

**Optional:** `jobs` (+ `worker` for background processing)

**Built on demand:** Domain systems (bookings, CRM, CMS, ecommerce, AI) are not scaffolded packages. Every project ships embedded skills that teach your AI tool to build them. See `.opencode/skills/` in your scaffolded project.

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
npx @techstream/quark-create-app update --scaffold-check
npx @techstream/quark-create-app update --scaffold-check --fail-on-drift
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

- **Cleanup check**: `pnpm clean:check`
- **Cleanup build artifacts**: `pnpm clean`
- **Cleanup build artifacts + temp workspaces**: `pnpm clean:deep`
- **Dev auto-clean opt-out**: `QUARK_SKIP_AUTO_CLEAN=1 pnpm dev`
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

- `pnpm changeset` - add a changeset
- `pnpm version-packages` - bump versions & update changelogs (local)
- `pnpm release` - publish changed packages to npm (local)

> **Note:** Publishing is handled automatically by CI. The local scripts are for debugging only.

## Documentation

- **[Start Here](./docs/START_HERE.md)** - Current onboarding path for new Quark projects
- **[First Feature Guide](./docs/FIRST_FEATURE.md)** - End-to-end walkthrough for adding a real domain feature
- **[Documentation Index](./docs/INDEX.md)** - Start here to navigate all documentation
- **[Developer Guide](./copilot-instructions.md)** - Setup, conventions, and workflows
- **[Architecture](./docs/ARCHITECTURE.md)** - Core design patterns and distribution model
- **[API Reference](./docs/API.md)** - API documentation and endpoints
- **[Security Guide](./docs/SECURITY.md)** - Security features, checklists, and incident response
- **[Usage Guide](./docs/QUARK_USAGE.md)** - Full development and CLI workflow
- **[Maintainability Guide](./docs/MAINTAINABILITY.md)** - Code style and best practices
- **[Design Notes](./docs/DESIGN_NOTES.md)** - Accepted architectural direction and design decisions
