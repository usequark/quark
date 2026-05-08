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

# Update Quark packages in an existing project
npx @techstream/quark-create-app update

# Check for available updates without applying them
npx @techstream/quark-create-app update --check
```

Aliases:
- `quark-create-app`
- `create-quark-app`
- `quark-update`

## Usage with Flags

The CLI supports non-interactive mode with custom options for automation and CI/CD workflows.

### Non-Interactive Mode

Skip all interactive prompts and use defaults:

```bash
# Create project without prompts
npx @techstream/quark-create-app my-app --no-prompts
```

### Custom Features

Specify which optional packages to include (default: `ui,jobs`; valid: `ui`, `jobs`, `admin`, `cms`):

```bash
# Only include UI package
npx @techstream/quark-create-app my-app --no-prompts --features ui

# Include both UI and Jobs
npx @techstream/quark-create-app my-app --no-prompts --features ui,jobs

# Include admin plus the CMS section explicitly
npx @techstream/quark-create-app my-app --no-prompts --features ui,admin,cms

# Minimal setup (no optional packages)
npx @techstream/quark-create-app my-app --no-prompts --features ""
```

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
