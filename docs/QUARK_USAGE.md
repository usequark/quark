# Quark: Complete Usage Guide

This guide covers the complete Quark workflow-from development to scaffolding new projects to keeping them updated.

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
git clone https://github.com/usequark/quark
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

# Create a changeset describing your change (interactive)
pnpm changeset

# Commit code + the generated .changeset/*.md file
git add .
git commit -m "feat: add new feature"
git push origin your-branch
```

Then open a PR. Once merged to `main`, CI automatically opens a **"chore: version packages"** PR. Merge that PR to publish to npm and create a GitHub Release.

> **Never run `git tag` manually** and never run `pnpm changeset version` locally - CI owns both steps.

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
pnpm add -g @techstream/quark-create-app

# Scaffold from anywhere
quark-create-app my-awesome-app
```

### What Gets Scaffolded?

The CLI creates a complete project structure with:

```
my-awesome-app/
├── .env.example              ← Environment variables template
├── .env                      ← Auto-generated secure secrets
├── .quark-link.json          ← Tracks Quark version & packages
├── .gitignore
├── MAIN.md                     ← "Read this first" project brief & entry point
├── CLAUDE.md                   ← AI context: stack, patterns, key files
├── .opencode/skills/           ← Embedded domain skills (harness-selectable)
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml        ← PostgreSQL, Redis, Mailpit
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

The CLI automatically generates secure secrets and runs `pnpm install`. After scaffolding:

```bash
cd my-awesome-app

# 1. Start services
docker compose up -d

# 2. Run development server
pnpm dev
```

---

## Package Installation

### How It Works

All Quark packages (`@techstream/quark-core`, `@techstream/quark-create-app`) are published to **npmjs.org** as public packages. No authentication is required to install or update them.

```bash
# Install/update Quark core
pnpm update @techstream/quark-core

# Or use the built-in update command
quark-update
```

### Common Scenarios

#### Local Development

```bash
cd my-app
pnpm dev
```

#### CI/CD (GitHub Actions)

No authentication tokens needed - all packages are public:

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: pnpm install
      - run: pnpm test
```

#### Docker

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY . .
RUN pnpm install
```

Production note: the scaffolded deploy images use the generated [apps/web/Dockerfile](../apps/web/Dockerfile) and [apps/worker/Dockerfile](../apps/worker/Dockerfile), not this minimal example.

Quark currently pins `node:22-alpine` for those Dockerfiles instead of using unversioned `cgr.dev/chainguard/node:latest`.

- The deploy contract is currently Node 22, and `latest` can silently move that contract.
- During evaluation, `cgr.dev/chainguard/node:latest` resolved to Node 26, which would have changed the runtime major without an explicit Quark release decision.
- A pinned Alpine image keeps builds reproducible, matches the runtime validated by the scaffold build harness and CI image scans, and still gives Quark a small low-surface runtime.
- Revisit Chainguard once a versioned Node 22 tag is available and validated against Quark's web and worker images.

#### Cloning Repo to New Environment

```bash
# 1. Clone the repo
git clone https://github.com/yourorg/my-app
cd my-app

# 2. Create .env from template
cp .env.example .env

# 3. Install
pnpm install
```

---

## Using Quark Packages

### Distribution Model

Quark uses a **Core-Only Registry** architecture:

- **`@techstream/quark-core`** is published to npmjs.org (you consume it like any npm package)
- **All other packages** (`db`, `ui`, `jobs`, `config`) are scaffolded locally in your project

This gives you:
- Centralized infrastructure updates (core utilities)
- Full control over business logic (database schema, UI components, jobs)

### Core Infrastructure Package

#### `@techstream/quark-core`

Infrastructure provided via npmjs.org. Includes authentication, password hashing, validation, error handling, and job queue infrastructure.

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
} from "@techstream/quark-core";

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

See [DATABASE.md](./DATABASE.md) for full API reference.

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

React components and UI primitives for your application. The full component library with dark mode support built in.

**Available components:**
- `Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox` - form primitives
- `Badge` - status labels
- `Card` / `CardHeader` / `CardTitle` / `CardContent` / `CardFooter` - content containers
- `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` - data tables
- `Skeleton` - loading placeholders
- `Dialog` *(client)* - modal dialogs
- `Toast` / `useToast` *(client)* - notifications
- `ThemeProvider` / `useTheme` *(client)* - dark/light mode context
- `QuarkLogo` *(server)* - inline SVG logo, theme-aware

**Why it's optional:** Not all apps need a shared component library. If scaffolded, you customize components to match your design system.

---

## Dark Mode / Theme System

Quark uses a **dark-mode-first** theme system. Every scaffolded project ships with full dark and light mode support, zero flash on load.

### How the theme is applied

Theme is controlled by a `data-theme` attribute on `<html>` (`"dark"` or `"light"`), not by a CSS class. Tailwind's `dark:` utilities are wired to `data-theme` via a custom variant in `globals.css`.

A blocking inline `<script>` in `layout.js` reads `localStorage` and `prefers-color-scheme` synchronously before the first paint - no flash.

### Using ThemeProvider

Wrap your app (or a subtree) in `ThemeProvider` to enable programmatic theme control:

```jsx
import { ThemeProvider } from "@yourscope/ui";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultTheme="dark">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Reading and setting the theme

```jsx
"use client";
import { useTheme } from "@yourscope/ui";

export function MyToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      Switch to {theme === "dark" ? "light" : "dark"} mode
    </button>
  );
}
```

`ThemeProvider` is optional for simple use cases - the FOUC prevention script and CSS variables work without it. Use it only when a component needs to read or programmatically change the theme.

### Dark mode in your own components

Use Tailwind's `dark:` utilities anywhere - they react to the `data-theme` attribute automatically:

```jsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Dark-aware content
</div>
```

---

**Key Distinction:**
- **Core infrastructure** (`@techstream/quark-core`) → You receive updates via `pnpm update`
- **Business logic** (`@yourscope/db`, `@yourscope/ui`, etc.) → You own and evolve these

---

## Email Service

Quark's email service uses a **Strategy Pattern** - swap providers without changing any call sites.

### Sending Email

```javascript
import { createEmailService } from "@techstream/quark-core";

const email = createEmailService({
  from: process.env.EMAIL_FROM,
  provider: process.env.EMAIL_PROVIDER, // "smtp" | "resend" | "zeptomail"
});

await email.sendEmail(
  "user@example.com",
  "Welcome!",
  "<p>Thanks for signing up.</p>",
  "Thanks for signing up.",
);
```

### Choosing a Provider

Set `EMAIL_PROVIDER` in your `.env`:

| Value        | Required vars                               |
|--------------|---------------------------------------------|
| `smtp`       | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| `resend`     | `RESEND_API_KEY`                            |
| `zeptomail`  | `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_URL`          |

All providers return `{ id, ...providerData }` from `sendEmail()`.

Provider config is validated at **service-creation time** - misconfigured providers fail immediately at app startup rather than silently at send time.

### Registering a Custom Provider

```javascript
import { EmailProvider, registerEmailProvider, createEmailService } from "@techstream/quark-core";

class MyProvider extends EmailProvider {
  validateConfig() {
    if (!process.env.MY_API_KEY) {
      throw new Error("MY_API_KEY is required for MyProvider");
    }
  }

  async sendEmail(to, subject, html, text) {
    const res = await fetch("https://api.myprovider.io/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.MY_API_KEY}` },
      body: JSON.stringify({ to, subject, html, text }),
    });
    const data = await res.json();
    return { id: data.messageId, ...data };
  }
}

// Register once at app startup (e.g., in server.js / app.js)
registerEmailProvider("myprovider", MyProvider);

// Then use it like any built-in provider
const email = createEmailService({
  from: process.env.EMAIL_FROM,
  provider: "myprovider",
});
```

### Local Development (Mailpit)

Mailpit is included in `docker-compose.yml` as a local SMTP sink. All outbound email is captured and viewable at `http://localhost:8025`. No `.env` changes needed for the default `smtp` provider in dev.

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
- Run `pnpm update @techstream/quark-core`
- Update `.quark-link.json`
- Provide next steps

**Note:** This only updates core infrastructure. Your local packages (`db`, `ui`, `jobs`) are not affected.

### Method 2: Manual Update

```bash
# Update core infrastructure
pnpm update @techstream/quark-core

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
2. **Run tests** - they will fail with detailed error messages
3. **Follow migration guides** in Quark docs
4. **Test locally** before pushing

Example breaking change workflow:

```bash
# Update fails or tests fail
pnpm update @techstream/quark-core
pnpm test  # ❌ Tests fail

# Read the error and migration guide
# Make necessary code changes
# Test again
pnpm test  # ✅ Tests pass

# Commit
git commit -am "chore: migrate to Quark v2.0"
```

---

## Understanding `.quark-link.json`

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

# Email (Mailpit for local testing)
MAIL_SMTP_PORT=1025
MAIL_UI_PORT=8025

# Application
NODE_ENV=development
DATABASE_URL=postgresql://quark:development@localhost:5432/my_app_dev
REDIS_URL=redis://localhost:6379

```

---

## Troubleshooting

### `Error: Cannot find module '@techstream/quark-core'`

**Problem:** Dependencies not installed.

```bash
pnpm install
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

Clear the cache and reinstall:

```bash
pnpm store prune
pnpm install
```

### Next.js build fails after Quark update

Make sure `next.config.js` includes Quark packages in `transpilePackages`:

```javascript
// apps/web/next.config.js
const nextConfig = {
  transpilePackages: [
    "@techstream/quark-core",
    "@techstream/quark-db",
    "@techstream/quark-ui",
    "@techstream/quark-jobs",
  ],
};
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Create new project | `pnpm new my-app` (from Quark root) or `quark-create-app my-app` |
| Install dependencies | `pnpm install` |
| Update Quark packages | `quark-update` or `pnpm update @techstream/quark-*` |
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

**Questions?** Open an issue at https://github.com/usequark/quark/issues
