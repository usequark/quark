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

# Update Quark core in an existing project
npx @techstream/quark-create-app update

# Check for updates without applying
npx @techstream/quark-create-app update --check
```

Aliases:
- `quark-create-app`
- `create-quark-app`
- `quark-update`

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
