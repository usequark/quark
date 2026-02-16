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

## Common Tasks

- **Update Quark packages**: `quark-update` or `pnpm update @techstream/quark-*`
- **Check for updates**: `quark-update --check`
- **Configure environment**: Edit `.env` file (see `.env.example`)

## Support

For issues, questions, and discussions:
- 🐛 [Issue Tracker](https://github.com/Bobnoddle/quark/issues)
- 💬 [Discussions](https://github.com/Bobnoddle/quark/discussions)
