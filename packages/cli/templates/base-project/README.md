<p align="center">
  <img src="apps/web/public/images/logos/logo.png" alt="__QUARK_PROJECT_NAME__" width="400" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js 22" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?style=flat&logo=prisma&logoColor=white" alt="Prisma 7" />
</p>

---

## Quick Start

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

Open [http://localhost:__QUARK_WEB_PORT__](http://localhost:__QUARK_WEB_PORT__)

## Services

| Service    | Description                | Port(s)            |
| ---------- | -------------------------- | ------------------ |
| PostgreSQL | Database                   | `5432`             |
| Redis      | Cache & job queue          | `6379`             |
| Mailpit    | Local SMTP / email viewer  | `1025` / `8025`    |

```bash
docker compose up -d   # start all services
docker compose down    # stop all services
```

## Development

```bash
pnpm build   # Build all packages
pnpm test    # Run tests
pnpm lint    # Lint & format (Biome)
```

## Database

| Task                       | Command             |
| -------------------------- | ------------------- |
| Run migrations             | `pnpm db:migrate`   |
| Push schema (no migration) | `pnpm db:push`      |
| Generate Prisma client     | `pnpm db:generate`  |
| Seed database              | `pnpm db:seed`      |
| Open Prisma Studio         | `pnpm db:studio`    |

## Project Structure

```
__QUARK_PROJECT_NAME__/
apps/
  web/        → Next.js 16 (App Router, Server Actions)
__QUARK_OPTIONAL_APPS__packages/
  config/     → Shared environment & app configuration
  db/         → Prisma schema, migrations & queries
  jobs/       → Job definitions shared between web & worker
  ui/         → Shared UI component library
```

## Tech Stack

- **Framework** - Next.js 16 (React 19)
- **Styling** - Tailwind CSS 4
- **Database** - PostgreSQL 16 + Prisma 7
- **Queue** - Redis 7 (BullMQ)
- **Auth** - NextAuth.js v5
- **Monorepo** - pnpm workspaces + Turborepo
- **Linting** - Biome

## License

Private - All rights reserved.

<!-- Scaffolded with Quark on __QUARK_SCAFFOLD_DATE__ -->
