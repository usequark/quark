# @techstream/quark-create-app CLI

Scaffold a new Quark project with sensible defaults for full-stack JavaScript development.

## Installation

```bash
npx @techstream/quark-create-app@latest my-awesome-app
```

The CLI scaffolds a complete project structure with:
- **Next.js** web application
- **Prisma** database schema and migrations
- **BullMQ** job queues
- **Docker Compose** setup (PostgreSQL, Redis, Mailpit)
- **JavaScript** monorepo with `pnpm` workspaces

## Quick Setup

```bash
cd my-awesome-app
docker compose up -d
pnpm db:migrate
pnpm dev
```

## Commands

```bash
# Create a new project
npx @techstream/quark-create-app@latest my-awesome-app

# Add a feature (package or domain starter) to an existing project
npx @techstream/quark-create-app add cms

# Print an AI prompt recipe for a feature
npx @techstream/quark-create-app recipe bookings

# Update Quark packages in an existing project
npx @techstream/quark-create-app update

# Check for available updates without applying them
npx @techstream/quark-create-app update --check

# Report drift in scaffold-managed files without overwriting anything
npx @techstream/quark-create-app update --scaffold-check

# Fail CI when scaffold drift is detected
npx @techstream/quark-create-app update --scaffold-check --fail-on-drift
```

Aliases:
- `quark-create-app`
- `create-quark-app`
- `quark-update`

## Two Views

The CLI exposes two views over the same engine:

- **Human View (default, no params)** — interactive, product-shaped questions. It asks you to describe your app (which seeds `MAIN.md`), then an **advanced** expander for full package/custom configuration. Progressive disclosure: simple by default.
- **AI View (params)** — a documented, deterministic flag surface (`--features`, `--preset`, `--prompt`, `--no-prompts`) that an agent calls reliably. Same params → same scaffold, every time.

### Human View

```bash
# Interactive: describe your app, then configure features
npx @techstream/quark-create-app my-app
```

### AI View (deterministic params)

Skip all interactive prompts and use defaults:

```bash
# Create project without prompts
npx @techstream/quark-create-app my-app --no-prompts
```

### Custom Features

Specify which optional features to include (default: `ui,jobs`; valid: `ui`, `jobs`, `admin`, `bookings`, `crm`, `cms`, `ai`):

```bash
# Only include UI package
npx @techstream/quark-create-app my-app --no-prompts --features ui

# Include both UI and Jobs
npx @techstream/quark-create-app my-app --no-prompts --features ui,jobs

# Include admin plus the CMS starter explicitly
npx @techstream/quark-create-app my-app --no-prompts --features ui,admin,cms

# Minimal setup (no optional packages)
npx @techstream/quark-create-app my-app --no-prompts --features ""
```

### Presets

Bundle a set of features with one flag:

```bash
# Client-work bundle (ui, jobs, admin)
npx @techstream/quark-create-app my-app --no-prompts --preset client-work

# Internal tool (ui, admin)
npx @techstream/quark-create-app my-app --no-prompts --preset internal-tool

# Minimal (no optional features)
npx @techstream/quark-create-app my-app --no-prompts --preset minimal
```

Valid presets: `client-work`, `internal-tool`, `product`, `minimal`.

### Product brief

Seed the `MAIN.md` brief from a prompt (AI View):

```bash
npx @techstream/quark-create-app my-app --no-prompts --prompt "A booking platform for salons"
```

### recipe command

Print an AI prompt recipe for a feature:

```bash
# Print the bookings starter recipe
npx @techstream/quark-create-app recipe bookings

# Print a core recipe (model, endpoint, dashboard)
npx @techstream/quark-create-app recipe model
npx @techstream/quark-create-app recipe endpoint
npx @techstream/quark-create-app recipe dashboard
```

Available recipes: `model`, `endpoint`, `dashboard`, `bookings`, `crm`, `cms`, `ai`.

### Skip Installation Steps

Create the project structure without running package installation:

```bash
# Create project but skip pnpm install
npx @techstream/quark-create-app my-app --no-prompts --skip-install

# Useful for CI/CD where you'll install dependencies separately
```

### Docker Cleanup

Control whether to remove Docker volumes from previous cleanup:

```bash
# Keep Docker working directories (useful in CI/CD)
npx @techstream/quark-create-app my-app --no-prompts --skip-docker
```

### Complete Example: Full Automation

```bash
# Create, install, and setup everything automatically
npx @techstream/quark-create-app my-app \
  --no-prompts \
  --features ui,jobs \
  && cd my-app \
  && docker compose up -d \
  && pnpm db:migrate \
  && pnpm dev
```

## Common Tasks

- **Update Quark packages**: `quark-update` or `pnpm update @techstream/quark-*`
- **Check for updates**: `quark-update --check`
- **Review scaffold drift**: `quark-update --scaffold-check`
- **Fail CI on scaffold drift**: `quark-update --scaffold-check --fail-on-drift`
- **Configure environment**: Edit `.env` file (see `.env.example`)

## CLI Testing

```bash
# Lightweight template checks
pnpm test

# E2E scaffold simulation
pnpm test:e2e

# Full build verification (opt-in)
QUARK_CLI_BUILD_TEST=1 pnpm test:build
```

## Troubleshooting

- **pnpm install fails**: Ensure `pnpm` is installed and Node.js >= 22.
- **Prisma generate fails**: Run `pnpm --filter db db:generate` inside the project.
- **Docker ports conflict**: The CLI auto-selects free ports. Check `.env` for assigned values.
- **Missing env vars**: Copy `.env.example` to `.env` and fill required values.

## Support

For issues, questions, and discussions:
- 🐛 [Issue Tracker](https://github.com/Bobnoddle/quark/issues)
- 💬 [Discussions](https://github.com/Bobnoddle/quark/discussions)
