# Quark: Complete Usage Guide

This guide covers the complete Quark workflow, from development to scaffolding new projects to keeping them updated.

Every version, script name, flag, and file path below is checked against the repo. Where something does not exist, this guide says so.

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
# From the Quark repo root
pnpm new my-awesome-app

# `pnpm new` is a thin wrapper: `node packages/cli/src/index.js`
# This scaffolds the project into ./my-awesome-app
```

### Option 2: Global CLI Install (For External Use)

```bash
# Install the CLI globally
pnpm add -g @usequark/quark-create-app

# Scaffold from anywhere
quark-create-app my-awesome-app

# Or without installing anything
npx @usequark/quark-create-app@latest my-awesome-app
```

### Bin Names

All four bins point at the same entrypoint (`packages/cli/src/index.js`):

| Bin | Use it for |
|-----|-----------|
| `quark` | Default, shortest name |
| `quark-create-app` | Explicit, self-documenting |
| `create-quark-app` | `create-react-app` style alias |
| `quark-update` | Reads as an update command |

### Creating a Project Is the Default Action

There is **no `create` subcommand**. Passing a project name (or nothing, to be prompted) runs the scaffolder:

```bash
quark my-app                      # scaffold with this name
quark                             # interactive, prompts for the name
```

The `sync-templates` and `sync-templates:check` names are **npm scripts** in `packages/cli`, not CLI subcommands:

```bash
pnpm --filter @usequark/quark-create-app sync-templates
pnpm --filter @usequark/quark-create-app sync-templates:check
```

### Subcommands

The complete list, from `grep -n '.command(' packages/cli/src/index.js`:

| Subcommand | Purpose |
|------------|---------|
| `add <feature>` | Add an optional package to an existing project |
| `skill <name>` | Print an embedded skill for a feature |
| `update` | Update Quark packages in an existing project |
| `deploy railway` | Deploy web + worker + Postgres + Redis to Railway |
| `deploy inspect` | Inspect project deployment readiness |
| `deploy status` | Check deployed service status |

```bash
quark add jobs
quark skill bookings
quark update
quark deploy railway --dry-run
```

### Root Options

```bash
quark my-app --packages ui,jobs,pwa,mobile
quark my-app --signup disabled
quark my-app --prompt "A booking platform for salons"
quark my-app --harness claude
quark my-app --skip-install
quark my-app --skip-docker
```

| Option | Effect |
|--------|--------|
| `--no-prompts` | **Deprecated.** Emits `⚠ --no-prompts is deprecated. Options now auto-skip prompts.` Supplying options already implies non-interactive mode. |
| `--signup <mode>` | Public self-service signup for the scaffolded project: `enabled` or `disabled` |
| `--packages <list>` | Optional packages to include. Valid values: `ui`, `jobs`, `pwa`, `mobile` |
| `--prompt <text>` | Product brief used to populate `MAIN.md` |
| `--harness <name>` | Where embedded skills land: `opencode` (default), `claude`, `copilot` |
| `--skip-install` | Skip `pnpm install` and Prisma generate steps |
| `--skip-docker` | Skip Docker orphan-volume cleanup |

There is **no `--preset` flag** and no named presets. `db`, `config`, and `ui` are always scaffolded (`REQUIRED_PACKAGES` in `packages/cli/src/index.js`); `--packages` selects only the optional set.

With `--no-prompts` and no `--packages`, the default optional set is `ui,jobs`.

### Subcommand Flags

`update`:

```bash
quark update --check              # report available updates, apply nothing
quark update --scaffold-check     # report scaffold drift, overwrite nothing
quark update --scaffold-check --fail-on-drift   # exit 1 on drift, for CI
quark update --force              # skip uncommitted-changes safety check
```

`add`:

```bash
quark add jobs --force            # skip uncommitted-changes safety check
quark add jobs --skip-install     # skip pnpm install after adding
```

`deploy railway`:

```bash
quark deploy railway --project-name my-app      # create a new Railway project
quark deploy railway --project-id <id>          # link to an existing project
quark deploy railway --environment staging      # default: production
quark deploy railway --no-provision             # skip Postgres and Redis plugins
quark deploy railway --dry-run                  # validate config, deploy nothing
```

### Non-Interactive Example

```bash
quark my-app \
  --packages ui,jobs \
  --signup disabled \
  --skip-install \
  && cd my-app \
  && pnpm install \
  && docker compose up -d \
  && pnpm db:migrate \
  && pnpm dev
```

### What Gets Scaffolded?

```
my-awesome-app/
├── .env                      ← Auto-generated, with fresh secrets
├── .env.example              ← Environment variables template
├── .env.railway.example      ← Railway variable template
├── .quark-link.json          ← Tracks Quark version & packages
├── .nvmrc                    ← Node 24
├── .gitignore
├── .dockerignore
├── MAIN.md                   ← "Read this first" project brief and entry point
├── CLAUDE.md                 ← AI context: stack, patterns, key files
├── .cursor/rules/            ← Cursor rule file
├── skills/                   ← Embedded domain skills
├── .opencode/skills/         ← Where skills land with --harness opencode (default)
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── biome.json
├── docker-compose.yml        ← PostgreSQL, Redis
├── docker-compose.override.yml ← Mailpit (dev only, auto-merged)
├── .railway/                 ← Railway config
├── .github/                  ← GitHub Actions workflows
├── docs/
├── scripts/
├── README.md
├── apps/
│   └── web/                  ← Next.js 16 application
├── packages/
│   ├── db/                   ← <scope>/db, always scaffolded
│   ├── config/               ← <scope>/config, always scaffolded
│   └── ui/                   ← <scope>/ui, always scaffolded
└── .git/                     ← Git repo initialized with first commit
```

Always scaffolded: `db`, `config`, `ui`. Optionally scaffolded via `--packages`: `jobs`, `pwa`, `mobile`.

The CLI scaffolds a **new project folder** and initializes a git repository inside it. If you run it from inside an existing repository, the project lands one level below that repository's root, where pnpm workspaces, turbo, and GitHub Actions cannot see `package.json`. The CLI detects this, prints a warning, and skips git init. Scaffold outside the repository, or scaffold to a temp folder and move the files to the repository root before the first commit.

### Post-Scaffolding Setup

The CLI generates secrets into `.env`, initializes git with a first commit, and runs `pnpm install`. After scaffolding:

```bash
cd my-awesome-app

# 1. Start services (Postgres, Redis, Mailpit)
docker compose up -d

# 2. Create the database
pnpm db:migrate

# 3. Start development (web + worker)
pnpm dev
```

`docker compose up -d` reads `docker-compose.yml` (Postgres, Redis) and auto-merges `docker-compose.override.yml` (Mailpit, dev only).

---

## Package Installation

### How It Works

Exactly **two** packages are published to **npmjs.org** as public packages:

| Package | Version |
|---------|---------|
| `@usequark/quark-core` | 2.6.0 |
| `@usequark/quark-create-app` | 1.25.4 |

No authentication is required to install or update them. There are no published database, UI, jobs, or config packages, and no admin package.

```bash
# Install/update Quark core
pnpm update @usequark/quark-core

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

No authentication tokens needed, both packages are public:

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: pnpm install
      - run: pnpm test
```

#### Docker

```dockerfile
FROM node:24-alpine

WORKDIR /app
COPY . .
RUN pnpm install
```

Production note: the scaffolded deploy images use the generated [apps/web/Dockerfile](../apps/web/Dockerfile) and [apps/worker/Dockerfile](../apps/worker/Dockerfile), not this minimal example.

Quark pins `node:24-alpine` for those Dockerfiles, by digest, instead of using unversioned `cgr.dev/chainguard/node:latest`.

- The deploy contract is currently Node 24, and `latest` can silently move that contract.
- During evaluation, `cgr.dev/chainguard/node:latest` resolved to Node 26, which would have changed the runtime major without an explicit Quark release decision.
- A pinned Alpine image keeps builds reproducible, matches the runtime validated by the scaffold build harness and CI image scans, and still gives Quark a small low-surface runtime.
- Revisit Chainguard once a versioned Node 24 tag is available and validated against Quark's web and worker images.

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

- **`@usequark/quark-core`** (2.6.0) is published to npmjs.org. You consume it like any npm package.
- **`@usequark/quark-create-app`** (1.25.4) is published to npmjs.org. It is the scaffolder.
- **Four packages are scaffolded into your project** and scoped to your npm scope: `db`, `config`, `ui`, `jobs`. Three of those (`db`, `config`, `ui`) are always present. `jobs` is optional.

Nothing else is published. There is no published database, UI, jobs, or config package, and no admin package.

This gives you:
- Centralized infrastructure updates (core utilities)
- Full control over business logic (database schema, UI components, jobs)

### Core Infrastructure Package

#### `@usequark/quark-core`

Infrastructure provided via npmjs.org. Includes authentication, password hashing, validation, error handling, logging, storage, and job queue infrastructure.

```javascript
// In your application
import { createAuthConfig, hashPassword, verifyPassword } from "@usequark/quark-core";
import { createQueue, createWorker } from "@usequark/quark-core";
import { validateBody } from "@usequark/quark-core";
import { AppError, ValidationError } from "@usequark/quark-core/errors";
import { createLogger } from "@usequark/quark-core";

// Example: Set up authentication
const authConfig = createAuthConfig({
  providers: [
    // Your providers
  ],
});

// Example: Hash and verify passwords
const hashed = await hashPassword("user-password");
const isValid = await verifyPassword("user-password", hashed);

// Example: Throw typed errors, never a bare Error
throw new AppError("Something broke", 500, "INTERNAL_ERROR");

// Example: Log through the logger, never the console
const logger = createLogger({ name: "auth" });
logger.info("Password verified", { isValid });
```

Note the subpath imports. `@usequark/quark-core/errors` and `@usequark/quark-core/testing` are separate entry points. Testing utilities in particular are deliberately **not** re-exported from the root barrel, so they stay out of production import graphs.

The complete subpath list from the package's `exports` map:

```
@usequark/quark-core                 → src/index.js
@usequark/quark-core/core            → src/core.js
@usequark/quark-core/errors          → src/errors.js
@usequark/quark-core/testing         → src/testing/index.js
@usequark/quark-core/auth            → src/auth/index.js
@usequark/quark-core/auth/middleware → src/auth/middleware.js
@usequark/quark-core/admin           → src/admin.js
@usequark/quark-core/db              → src/db.js
@usequark/quark-core/email           → src/email.js
@usequark/quark-core/health          → src/health.js
@usequark/quark-core/locale          → src/locale.js
@usequark/quark-core/logger          → src/logger.js
@usequark/quark-core/metrics         → src/metrics.js
@usequark/quark-core/queue           → src/queue/index.js
@usequark/quark-core/sms             → src/sms.js
@usequark/quark-core/storage         → src/storage.js
@usequark/quark-core/storage/s3      → src/storage-s3.js
@usequark/quark-core/stripe          → src/stripe.js
```

`/core` here is a **subpath inside** `@usequark/quark-core`. It is not a package of its own, and there is no admin, database, UI, jobs, or config package published to npm.

See [packages/core/README.md](../packages/core/README.md) for the full API reference.

### Local Business Logic Packages

These four are scaffolded into your project and customized for your needs. `@<scope>` below stands for your npm scope, chosen at scaffold time.

#### `<scope>/db` (Always Included)

Database layer: Prisma client, query helpers, Zod schemas. You customize the schema for your domain.

```javascript
// In your application
import { prisma, user } from "@myscope/db";

// The user helper: findById, findByEmail, findAll, create, update, delete, count
const users = await user.findAll({ skip: 0, take: 10 });
const created = await user.create({ email: "hello@example.com", name: "Hello" });
```

`user.findById`, `user.findAll`, `user.create`, and `user.update` all apply `USER_SAFE_SELECT`, which excludes `password`. `user.findByEmail` returns **all** fields including `password`, so it is for internal auth only. Never send its result to a client.

`packages/db/src/queries.js` exports helpers for exactly seven models:

```
user, job, account, session, verificationToken, auditLog, file
```

There is no `Post` model and no `post` helper. The base schema is `User`, `Account`, `Session`, `VerificationToken`, `Job`, `File`, `AuditLog`. Add domain models through the `add-model` skill and add matching helpers to `queries.js` yourself.

The generated Prisma client lives at `packages/db/src/generated/prisma`, the generator's declared `output`. Run `pnpm db:generate` after changing the schema.

See [DATABASE.md](./DATABASE.md) for the full reference.

#### `<scope>/config` (Always Included)

Configuration and environment variable validation specific to your application. Always scaffolded alongside `db`.

```javascript
import { config, loadEnv, getAppUrl, getAllowedOrigins } from "@myscope/config";

// Validate and load the environment
loadEnv();

// Static app identity, defaults from APP_NAME / APP_DESCRIPTION
config.appName;
config.appDescription;

// URL helpers
getAppUrl();
getAllowedOrigins();
```

`packages/config/src/index.js` is the authoritative export list:

```
config
getAllowedOrigins, getAppUrl, syncNextAuthUrl
ENVIRONMENTS, getEnvironmentConfig, mergeConfig, resolveEnvironment
getConfig, loadConfig, resetConfig
applyRateLimit, rateLimit
closeSharedRedisClient, getSharedRedisClient
loadEnv
```

`loadEnv` is the exported entry point. There is an internal `validate-env.js` module, but `validateEnv` is **not** exported from the barrel. Do not import it.

#### `<scope>/jobs` (Optional)

Job queue definitions and handlers specific to your business logic. Include it with `--packages jobs` or add it later with `quark add jobs`.

```javascript
import { JOB_QUEUES, JOB_NAMES } from "@myscope/jobs";

// Queue names
JOB_QUEUES.EMAIL; // "email-queue"
JOB_QUEUES.FILES; // "files-queue"
JOB_QUEUES.PUSH; // "push-queue"
JOB_QUEUES.DEFAULT; // "default-queue"

// Job type names
JOB_NAMES.SEND_WELCOME_EMAIL; // "send-welcome-email"
JOB_NAMES.SEND_RESET_PASSWORD_EMAIL; // "send-reset-password-email"
JOB_NAMES.CLEANUP_ORPHANED_FILES; // "cleanup-orphaned-files"
JOB_NAMES.SEND_PUSH_NOTIFICATION; // "send-push-notification"
```

The queue machinery itself (`createQueue`, `createWorker`, `addJob`, `getJobStatus`, `closeAllQueues`, `checkQueueHealth`) comes from `@usequark/quark-core` and runs on BullMQ `^6.3.8`.

**Why it's optional:** Not all apps use background jobs. If you do, you customize the job types and handlers for your domain.

#### `<scope>/ui` (Always Included)

React components and UI primitives with dark mode support built in. Always scaffolded.

`packages/ui/src/index.js` is the authoritative list, and it has 24 modules:

```
badge, button, card, checkbox, container, dialog, error-banner, footer,
form-field, input, label, lightbox, logo, navbar, password-input, rich-text,
select, skeleton, spinner, table, textarea, theme, theme-constants, toast
```

Grouped by what they are for:

- **Form primitives**: `Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox`, `PasswordInput`, `FormField`
- **Status and content**: `Badge`, `Card` / `CardHeader` / `CardTitle` / `CardContent` / `CardFooter`, `Container`
- **Data**: `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell`
- **Loading**: `Skeleton`, `Spinner`
- **Client-side**: `Dialog`, `Lightbox`, `Toast` / `useToast`, `ThemeProvider` / `useTheme`
- **Layout**: `Navbar` / `MobileNavbar`, `Footer`, `ErrorBanner`
- **Content**: `RichText`
- **Brand and theme tokens**: `QuarkLogo`, `theme-constants`

Always import from `<scope>/ui`, never deep-import `<scope>/ui/src/button`.

Shared layout primitives (`Navbar`, `MobileNavbar`, `ErrorBanner`, `Footer`, `RichText`) take a `className` for one-off overrides. Extend those before writing a new component.

---

## Dark Mode / Theme System

Quark uses a **dark-mode-first** theme system. Every scaffolded project ships with full dark and light mode support, zero flash on load.

### How the theme is applied

Theme is controlled by a `data-theme` attribute on `<html>` (`"dark"` or `"light"`), not by a CSS class. Tailwind's `dark:` utilities are wired to `data-theme` via a custom variant in `globals.css`.

A blocking inline `<script>` in `layout.js` reads `localStorage` and `prefers-color-scheme` synchronously before the first paint - no flash.

### Using ThemeProvider

Wrap your app (or a subtree) in `ThemeProvider` to enable programmatic theme control:

```jsx
import { ThemeProvider } from "@myscope/ui";

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
import { useTheme } from "@myscope/ui";

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
- **Core infrastructure** (`@usequark/quark-core`) → You receive updates via `pnpm update`
- **Business logic** (`@myscope/db`, `@myscope/ui`, etc.) → You own and evolve these

---

## Email Service

Quark's email service uses a **Strategy Pattern** - swap providers without changing any call sites.

### Sending Email

```javascript
import { createEmailService } from "@usequark/quark-core";

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
import { EmailProvider, registerEmailProvider, createEmailService } from "@usequark/quark-core";
import { AppError } from "@usequark/quark-core/errors";

class MyProvider extends EmailProvider {
  // Throw AppError, never a bare Error, even in a provider subclass
  validateConfig() {
    if (!process.env.MY_API_KEY) {
      throw new AppError("MY_API_KEY is required for MyProvider", 500, "EMAIL_CONFIG");
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

Mailpit is a local SMTP sink defined in `docker-compose.override.yml`, not `docker-compose.yml`. Compose auto-merges the override on `docker compose up`, so `docker compose up -d` starts it alongside Postgres and Redis. All outbound email is captured and viewable at `http://localhost:8025` (or whatever `MAIL_UI_PORT` is set to). No `.env` changes are needed for the default `smtp` provider in dev.

Related env vars: `MAIL_HOST`, `MAIL_SMTP_PORT` (default 1025), `MAIL_UI_PORT` (default 8025). For production SMTP relay, use `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` instead of the `MAIL_*` set.

---

## Updating Quark

### Method 1: Using `quark-update` Command (Recommended)

```bash
# In your scaffolded project
quark-update

# Report available updates, apply nothing
quark-update --check

# Report drift in scaffold-managed files, overwrite nothing
quark-update --scaffold-check

# Fail CI when drift is detected (exit 1)
quark-update --scaffold-check --fail-on-drift

# Skip the uncommitted-changes safety check
quark-update --force
```

The CLI will:
- Check for uncommitted changes (warn you if found)
- Run `pnpm update @usequark/quark-core`
- Update `.quark-link.json` with the new core version
- Provide next steps

**Note:** This only updates core infrastructure. Your scaffolded packages (`db`, `config`, `ui`, `jobs`) are not affected. The `--scaffold-check` flag is separate and read-only: it reports drift between scaffold-managed files and the current CLI, which is useful in CI.

### Method 2: Manual Update

```bash
# Update core infrastructure
pnpm update @usequark/quark-core

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
pnpm update @usequark/quark-core
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
  "quarkVersion": "2.6.0",
  "quarkSourcePath": "../../quark",
  "scaffoldedDate": "2026-02-11T10:30:00Z",
  "packages": ["db", "config", "ui", "jobs"],
  "updatedDate": "2026-02-12T15:45:00Z"
}
```

`quarkVersion` tracks the **`@usequark/quark-core` version your project is on** (currently 2.6.0). It is what `quark-update` reads and writes. The scaffolded CLI is 1.25.4 and is not a runtime dependency of your project, so it does not appear here.

The `packages` list records the scaffolded set. `db`, `config`, and `ui` are always present. `jobs` appears only if you asked for it. `pwa` and `mobile` are recorded as feature selections without scaffolding code.

Created by the scaffolder, updated by `quark-update`, and excluded from scaffold drift checks (along with `.env`). Useful for:
- Tracking which core version your project uses
- Auditing when packages were added with `quark add`
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
│   ├── web/              # Your Next.js 16 application
│   └── worker/           # Your BullMQ worker (if you took --packages jobs)
├── packages/
│   ├── db/               # <scope>/db, always present
│   ├── config/           # <scope>/config, always present
│   ├── ui/               # <scope>/ui, always present
│   └── jobs/             # <scope>/jobs, only if requested
├── .quark-link.json      # Core version tracking (auto-generated)
├── docker-compose.yml    # PostgreSQL, Redis
├── docker-compose.override.yml  # Mailpit, dev only
└── package.json
```

There are no `admin`, `cms`, `crm`, or `ai` packages in a scaffolded project. The scaffolding templates ship exactly: `base-project`, `config`, `jobs`, `mobile`, `pwa`, `ui`, `worker`.

---

## Environment Variables

### In Scaffolded Projects

Create `.env` from `.env.example`:

The scaffolder writes a working `.env` for you, with generated secrets and with ports chosen to avoid collisions with whatever else is running. Copy `.env.example` to `.env` only if you are starting from a checkout that has no `.env`. The shape:

```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=quark_user
POSTGRES_PASSWORD=<generated>
POSTGRES_DB=quark_dev
# DATABASE_URL overrides the constructed URL if set

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_URL overrides the constructed URL if set

# Mail (Mailpit in development)
MAIL_HOST=localhost
MAIL_SMTP_PORT=1025
MAIL_UI_PORT=8025

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generated, at least 32 characters>
# Derived from APP_URL when unset. Must match the origin you browse on exactly.

# Application identity
APP_NAME=My App
APP_DESCRIPTION=...

# SEO: set true only in production
ALLOW_INDEXING=false

# Worker
WORKER_CONCURRENCY=5

# Storage: local or s3
STORAGE_PROVIDER=local
```

`.env` and `.quark-link.json` are both excluded from scaffold drift checks. Never commit `.env`.

---

## Troubleshooting

### `Error: Cannot find module '@usequark/quark-core'`

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

Make sure `next.config.js` includes your workspace packages in `transpilePackages`. Names use **your** scope, not `@usequark/`:

```javascript
// apps/web/next.config.js
const nextConfig = {
  transpilePackages: [
    "@usequark/quark-core",
    "@myscope/db",
    "@myscope/ui",
    "@myscope/jobs",
  ],
};
```

This is only needed for workspace-linked packages. `@usequark/quark-core` is consumed from npm and needs no entry beyond what the scaffold generates.

### Prisma client out of date after a schema change

The client is generated into `packages/db/src/generated/prisma`, not into `node_modules`, so it does not refresh automatically:

```bash
pnpm db:generate
```

Then re-run `pnpm db:migrate` if the schema change needs a migration.

---

## Quick Reference

### Creating and Updating

| Task | Command |
|------|---------|
| Create a project (from the Quark repo) | `pnpm new my-app` |
| Create a project (installed CLI) | `quark my-app` |
| Create without installing | `npx @usequark/quark-create-app@latest my-app` |
| Choose optional packages | `quark my-app --packages ui,jobs,pwa,mobile` |
| Add a package later | `quark add jobs` |
| Print a skill | `quark skill bookings` |
| Deploy to Railway (dry run) | `quark deploy railway --dry-run` |
| Update Quark core | `quark-update` |
| Check for updates | `quark-update --check` |
| Check scaffold drift | `quark-update --scaffold-check --fail-on-drift` |

There is no `create` subcommand and no `--preset` flag.

### Day-to-Day in a Scaffolded Project

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Start development | `pnpm dev` |
| Run tests | `pnpm test` |
| Run integration tests | `pnpm test:integration` |
| Lint and format | `pnpm lint` |
| Build | `pnpm build` |
| Generate Prisma client | `pnpm db:generate` |
| Run migrations | `pnpm db:migrate` |
| Start local services | `docker compose up -d` |
| Stop services | `docker compose down` |

### Day-to-Day in the Quark Monorepo

| Task | Command |
|------|---------|
| Run tests | `pnpm test` |
| Lint and format | `pnpm lint` |
| Repo convention checks | `pnpm standards` |
| Sync CLI templates | `pnpm --filter @usequark/quark-create-app sync-templates` |
| Check template drift | `pnpm --filter @usequark/quark-create-app sync-templates:check` |
| CLI unit tests | `pnpm --filter @usequark/quark-create-app test` |
| CLI full E2E | `pnpm --filter @usequark/quark-create-app test:e2e:full` |
| Create a changeset | `pnpm changeset` |

---

## Next Steps

- **Read** [packages/core/README.md](../packages/core/README.md) for API documentation
- **Read** [packages/cli/README.md](../packages/cli/README.md) for the full CLI reference
- **Read** [ARCHITECTURE.md](./ARCHITECTURE.md) to understand Quark design
- **Read** [MAINTAINABILITY.md](./MAINTAINABILITY.md) for best practices
- **Read** [TESTING_INFRASTRUCTURE.md](./TESTING_INFRASTRUCTURE.md) for the test suite layout and counts
- **Review** [API.md](./API.md) for package-specific APIs

---

**Questions?** Open an issue at https://github.com/usequark/quark/issues
