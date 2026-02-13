# @bobnoddle/quark-create-app CLI

Scaffold a new Quark project with sensible defaults for full-stack TypeScript development.

## Installation

```bash
npx @bobnoddle/quark-create-app@latest my-awesome-app
```

The CLI scaffolds a complete project structure with:
- **Next.js** web application
- **Prisma** database schema and migrations
- **BullMQ** job queues
- **Docker Compose** setup (PostgreSQL, Redis, Mailhog)
- **TypeScript** monorepo with `pnpm` workspaces

## Quick Setup

```bash
cd my-awesome-app
cp .env.example .env
# Add your GitHub PAT to .env (read:packages scope)
pnpm install
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Common Tasks

- **Update Quark packages**: `quark-update` or `pnpm update @bobnoddle/quark-*`
- **Check for updates**: `quark-update --check`
- **Configure environment**: Edit `.env` file (see `.env.example`)
- **Troubleshooting**: Ensure `GH_TOKEN` is set in `.env` before `pnpm install`

## Support

For issues, questions, and discussions:
- 🐛 [Issue Tracker](https://github.com/Bobnoddle/quark/issues)
- 💬 [Discussions](https://github.com/Bobnoddle/quark/discussions)
