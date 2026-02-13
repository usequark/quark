# Quark: Complete Usage Guide

This guide covers the complete Quark workflow—from development to scaffolding new projects to keeping them updated.

---

## Table of Contents

1. [Development Workflow](#development-workflow)
2. [Creating New Projects with CLI](#creating-new-projects-with-cli)
3. [Using Quark Packages](#using-quark-packages)
4. [Updating Quark](#updating-quark)
5. [Troubleshooting](#troubleshooting)

---

## Development Workflow

### Setting Up the Quark Repository

```bash
# Clone the Quark repository
git clone https://github.com/Bobnoddle/quark
cd quark

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Run linter
pnpm lint
```

### Making Changes to Quark Packages

Quark uses `pnpm workspaces` for monorepo development. Changes are live across all packages:

```bash
# Edit packages/core, packages/db, packages/ui, etc.
# Changes are immediately reflected in all workspace packages

# Test your changes
pnpm test
pnpm lint

# Commit and tag a release
git add .
git commit -m "feat: add new feature"
git tag v1.2.0
git push origin main --tags
```

**The GitHub Actions workflow will automatically publish to GitHub Packages when you push a tag.**

---

## Creating New Projects with CLI

### Option 1: From Quark Repository (Recommended for Teams)

```bash
# Navigate to your projects directory
cd ~/projects

# From Quark repo root, scaffold a new project
cd quark
pnpm new my-awesome-app

# This scaffolds the project in ../my-awesome-app
```

### Option 2: Global CLI Install (For External Use)

```bash
# Install the CLI globally
pnpm add -g @bobnoddle/quark-create-app

# Scaffold from anywhere
quark-create-app my-awesome-app
```

### What Gets Scaffolded?

The CLI creates a complete project structure with:

```
my-awesome-app/
├── .npmrc                    ← Auto-generated GitHub Packages config
├── .env.example              ← Environment variables template
├── .quark-link.json          ← Tracks Quark version & packages
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml        ← PostgreSQL, Redis, Mailhog
├── README.md
├── apps/
│   └── web/                  ← Next.js application
├── packages/
│   ├── ui/                   ← (Ejected) React UI components
│   ├── jobs/                 ← (Ejected) Job definitions & handlers
│   └── config/               ← (Optional eject) Configuration
└── .git/                     ← Git repo initialized with first commit
```

### Post-Scaffolding Setup

```bash
cd my-awesome-app

# 1. Create .env from template
cp .env.example .env

# 2. Edit .env and add your GitHub Personal Access Token
# Change: GH_TOKEN=YOUR_PAT_HERE
# To:     GH_TOKEN=github_pat_xxxxxxxxxxxx

# 3. Load environment variables
source .env

# 4. Install dependencies (downloads Quark packages from GitHub)
pnpm install

# 5. Start services
docker compose up -d

# 6. Run development server
pnpm dev
```

---

## Authentication: GH_TOKEN Setup

### How It Works

Quark uses **GitHub Packages** as a private package registry. To install Quark packages, `pnpm` needs an authentication token stored in your project's `.env` file.

**Key Points:**
- Each project has its own `.npmrc` (committed) that references `${GH_TOKEN}`
- Each project has its own `.env` (gitignored) that contains the actual token
- Run `source .env` before `pnpm install` to load the token
- Fully portable—clone the repo anywhere, add token to `.env`, it works

### Setup for New Projects

When you scaffold a project, the CLI generates:
- `.npmrc` — Registry configuration (safe to commit)
- `.env.example` — Template with `GH_TOKEN=YOUR_PAT_HERE`

**Your workflow:**

```bash
# After scaffolding
cd my-awesome-app
cp .env.example .env

# Edit .env and replace YOUR_PAT_HERE with your actual GitHub token
# GH_TOKEN=github_pat_xxxxxxxxxxxx

# Load the token and install
source .env
pnpm install
```

### Generating a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Give it a descriptive name: `Quark Packages`
4. Select scopes:
   - ✅ `read:packages` — to download Quark packages
   - ✅ `write:packages` — (optional) if publishing
5. Copy the token
6. Add to `.env` as `GH_TOKEN=github_pat_...`

**⚠️ Security:**
- `.env` is gitignored—never commit your token
- `.npmrc` only has `${GH_TOKEN}` reference—safe to commit
- Each team member uses their own GitHub PAT

### Common Scenarios

#### Local Development

```bash
# Every time you open a new terminal:
cd my-app
source .env
pnpm install  # or pnpm dev, pnpm build, etc.
```

**Tip:** Add this to your shell alias:
```bash
alias pnpm='source .env 2>/dev/null; pnpm'
```

#### CI/CD (GitHub Actions)

GitHub automatically provides tokens in workflows. Update your workflow:

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v3
      
      - name: Install dependencies
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Auto-provided by GitHub
        run: pnpm install
```

#### Docker

Pass the token at build time:

```dockerfile
FROM node:20-alpine
ARG GH_TOKEN
ENV GH_TOKEN=$GH_TOKEN

WORKDIR /app
COPY . .
RUN pnpm install
```

Build:
```bash
source .env
docker build --build-arg GH_TOKEN=$GH_TOKEN -t my-app .
```

#### Cloning Repo to New Environment

```bash
# 1. Clone the repo
git clone https://github.com/yourorg/my-app
cd my-app

# 2. Create .env from template
cp .env.example .env

# 3. Add your GitHub PAT to .env
# Edit: GH_TOKEN=github_pat_...

# 4. Install
source .env
pnpm install
```

---

## Using Quark Packages

### Distribution Model

Quark uses a **Core-Only Registry** architecture:

- **`@bobnoddle/quark-core`** is published to GitHub Packages (you consume it like any npm package)
- **All other packages** (`db`, `ui`, `jobs`, `config`) are scaffolded locally in your project

This gives you:
- Centralized infrastructure updates (core utilities)
- Full control over business logic (database schema, UI components, jobs)

### Core Infrastructure Package

#### `@bobnoddle/quark-core`

Infrastructure provided via GitHub Packages registry. Includes authentication, password hashing, validation, error handling, and job queue infrastructure.

```javascript
// In your application
import {
  createAuthConfig,
  hashPassword,
  verifyPassword,
  createQueue,
  createWorker,
  validateBody,
  AppError,
} from "@bobnoddle/quark-core";

// Example: Set up authentication
const authConfig = createAuthConfig({
  providers: [
    // Your providers
  ],
});

// Example: Hash and verify passwords
const hashed = await hashPassword("user-password");
const isValid = await verifyPassword("user-password", hashed);
```

See [packages/core/README.md](../packages/core/README.md) for full API reference.

### Local Business Logic Packages

These are scaffolded into your project and customized for your specific needs:

#### `@yourscope/db` (Always Included)

Database layer with Prisma client and query builders. You customize the schema for your domain.

```javascript
// In your application
import { prisma, user, post } from "@yourscope/db";

// Query users
const users = await user.findAll({ skip: 0, take: 10 });

// Create a post
const newPost = await post.create({
  title: "Hello World",
  content: "..."
});
```

**Why it's local:** Every app has unique data models. Your Prisma schema in `packages/db/prisma/schema.prisma` is completely customized.

See [packages/db/README.md](../packages/db/README.md) for full API reference.

#### `@yourscope/config` (Optional)

Configuration and environment variable validation specific to your application.

```javascript
import { validateEnv, loadEnv } from "@yourscope/config";

// Validate on app startup
const env = loadEnv();
```

**Why it's optional:** Not all apps need custom config validation beyond what's in `.env`.

#### `@yourscope/jobs` (Optional)
#### `@yourscope/jobs` (Optional)

Job queue definitions and handlers specific to your business logic.

```javascript
import { JOB_QUEUES, JOB_NAMES } from "@yourscope/jobs";

// Job queue names
console.log(JOB_QUEUES.EMAIL); // "email-queue"

// Job type names
console.log(JOB_NAMES.SEND_WELCOME_EMAIL);
```

**Why it's optional:** Not all apps use background jobs. If you do, you'll customize job types and handlers for your domain.

#### `@yourscope/ui` (Optional)

React components and UI primitives for your application.

**Why it's optional:** Not all apps need a shared component library. If scaffolded, you customize components to match your design system.

---

**Key Distinction:**
- **Core infrastructure** (`@bobnoddle/quark-core`) → You receive updates via `pnpm update`
- **Business logic** (`@yourscope/db`, `@yourscope/ui`, etc.) → You own and evolve these

---

## Updating Quark

### Method 1: Using `quark-update` Command (Recommended)

```bash
# In your scaffolded project
quark-update

# Or check for updates without applying
quark-update --check
```

The CLI will:
- Check for uncommitted changes (warn you if found)
- Run `pnpm update @bobnoddle/quark-core`
- Update `.quark-link.json`
- Provide next steps

**Note:** This only updates core infrastructure. Your local packages (`db`, `ui`, `jobs`) are not affected.

### Method 2: Manual Update

```bash
# Update core infrastructure
pnpm update @bobnoddle/quark-core

# Test your app still works
pnpm lint
pnpm test
pnpm build

# Commit
git add pnpm-lock.yaml
git commit -m "chore: update Quark core"
```

### Handling Breaking Changes

If a Quark update includes breaking changes:

1. **Check the changelog** in the Quark repository
2. **Run tests** — they will fail with detailed error messages
3. **Follow migration guides** in Quark docs
4. **Test locally** before pushing

Example breaking change workflow:

```bash
# Update fails or tests fail
pnpm update @bobnoddle/quark-core
pnpm test  # ❌ Tests fail

# Read the error and migration guide
# Make necessary code changes
# Test again
pnpm test  # ✅ Tests pass

# Commit
git commit -am "chore: migrate to Quark v2.0"
```

---

## Understanding `.npmrc` and `.quark-link.json`

### `.npmrc` (Auto-Generated)

Tells `pnpm` where to download Quark packages:

```properties
@bobnoddle:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_TOKEN}
```

**Don't edit this manually.** It's auto-generated and committed to git.

### `.quark-link.json` (Auto-Generated)

Tracks version and metadata:

```json
{
  "quarkVersion": "1.2.0",
  "quarkSourcePath": "../../quark",
  "scaffoldedDate": "2026-02-11T10:30:00Z",
  "packages": ["ui", "jobs"],
  "updatedDate": "2026-02-12T15:45:00Z"
}
```

Updated when you run `quark-update`. Useful for:
- Tracking which Quark version your project uses
- Auditing when packages were ejected
- Debugging compatibility issues

---

## Project Structure Reference

### Monorepo Layout (Development)

```
quark/
├── apps/
│   ├── web/              # Main Next.js app
│   └── worker/           # Background job processor
├── packages/
│   ├── core/             # Core infrastructure
│   ├── db/               # Database layer
│   ├── config/           # Configuration
│   ├── jobs/             # Job definitions
│   ├── ui/               # UI components
│   └── cli/              # Scaffolding CLI
├── docs/                 # Documentation
└── package.json
```

### Scaffolded Project Layout (After Creation)

```
my-app/
├── apps/
│   └── web/              # Your Next.js application
├── packages/
│   ├── ui/               # Your UI components (ejected)
│   ├── jobs/             # Your job handlers (ejected)
│   └── config/           # Your config (if ejected)
├── .npmrc                # GitHub Packages config (auto-generated)
├── .quark-link.json      # Version tracking (auto-generated)
├── docker-compose.yml    # Local development services
└── package.json
```

---

## Environment Variables

### In Scaffolded Projects

Create `.env` from `.env.example`:

```bash
# Database
POSTGRES_USER=quark
POSTGRES_PASSWORD=development
POSTGRES_DB=my_app_dev
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# Email (Mailhog for local testing)
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025

# Application
NODE_ENV=development
DATABASE_URL=postgresql://quark:development@localhost:5432/my_app_dev
REDIS_URL=redis://localhost:6379

# GitHub Packages Authentication
# Generate at https://github.com/settings/tokens with read:packages and write:packages scopes
# Required for pnpm install to download Quark packages
GH_TOKEN=YOUR_PAT
```

**Important:** Set `GH_TOKEN` environment variable before running `pnpm install`.

---

## Troubleshooting

### `Error: Cannot find module '@bobnoddle/quark-core'`

**Problem:** GH_TOKEN not loaded from `.env`.

```bash
# Make sure .env has your token:
# GH_TOKEN=github_pat_xxxxxxxxxxxx

# Load it and install:
source .env
pnpm install
```

### `Cannot find .npmrc in .gitignore`

**The `.npmrc` should be committed.** It's safe because it references `${GH_TOKEN}` (a variable, not the token itself).

Your `.env` should `.gitignore`:

```bash
# .gitignore
.env              # ← Don't commit (has actual token)
.env.local
node_modules/
.next/
```

### Update command says "uncommitted changes"

The CLI prevents accidentally overwriting your work. Commit first:

```bash
git add .
git commit -m "WIP: current work"

# Now update
quark-update
```

Or skip the check:

```bash
quark-update --force
```

### Quark package not updating

Verify your PAT has correct permissions:

```bash
# Required scopes: read:packages, write:packages, repo
# Generate at https://github.com/settings/tokens with classic token
```

Verify token is loaded:

```bash
echo $GH_TOKEN
# Should output your token
```

### Next.js build fails after Quark update

Make sure `next.config.js` includes Quark packages in `transpilePackages`:

```javascript
// apps/web/next.config.js
const nextConfig = {
  transpilePackages: [
    "@bobnoddle/quark-core",
    "@bobnoddle/quark-db",
    "@bobnoddle/quark-ui",
    "@bobnoddle/quark-jobs",
  ],
};
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Create new project | `pnpm new my-app` (from Quark root) or `quark-create-app my-app` |
| Install dependencies | `source .env && pnpm install` |
| Update Quark packages | `quark-update` or `pnpm update @bobnoddle/quark-*` |
| Check for updates | `quark-update --check` |
| Start development | `pnpm dev` |
| Run tests | `pnpm test` |
| Run linter | `pnpm lint` |
| Start local services | `docker compose up -d` |
| Stop services | `docker compose down` |

---

## Next Steps

- **Read** [packages/core/README.md](../packages/core/README.md) for API documentation
- **Read** [ARCHITECTURE.md](./ARCHITECTURE.md) to understand Quark design
- **Read** [MAINTAINABILITY.md](./MAINTAINABILITY.md) for best practices
- **Review** [docs/API.md](./API.md) for package-specific APIs

---

**Questions?** Open an issue at https://github.com/Bobnoddle/quark/issues
