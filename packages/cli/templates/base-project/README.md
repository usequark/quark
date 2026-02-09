# My Quark Project

A modern, scalable monorepo built with Quark.

## Quick Start

```bash
pnpm install
pnpm dev
```

## Services

- **Docker**: `docker compose up -d`
- **Database**: PostgreSQL on port 5432
- **Cache**: Redis on port 6379
- **Email**: Mailhog UI on port 8025

## Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

## Structure

- `apps/` - Applications (web, worker, etc.)
- `packages/` - Shared packages (ui, jobs, config, core, db, cli)
