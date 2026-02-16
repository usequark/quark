# My Quark Project

A modern, scalable monorepo built with Quark.

## Quick Start

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000

## Services

- **Docker**: `docker compose up -d`
- **Database**: PostgreSQL
- **Cache**: Redis
- **Email**: Mailpit

## Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

## Database

| Task | Command |
|------|--------|
| Run migrations | `pnpm db:migrate` |
| Push schema (no migration) | `pnpm db:push` |
| Generate Prisma client | `pnpm db:generate` |
| Seed database | `pnpm db:seed` |
| Open Prisma Studio | `pnpm db:studio` |

## Structure

- `apps/` - Applications (web, worker, etc.)
- `packages/` - Shared packages (ui, jobs, config, core, db, cli)
