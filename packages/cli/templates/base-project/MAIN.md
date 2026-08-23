# __QUARK_PROJECT_NAME__

> __QUARK_PROJECT_BRIEF__

## Read this first

1. `CLAUDE.md` - project rules and conventions (keep this updated)
2. `docs/` - guides and walkthroughs
3. `openapi.yaml` - API contract
4. `.opencode/skills/` - embedded skills (how to build bookings, CRM, CMS, AI, and more on this project)

## Quick start

```bash
docker compose up -d   # Start PostgreSQL, Redis, Mailpit
pnpm install           # Install dependencies
pnpm db:migrate        # Apply migrations
pnpm dev               # Start the app (and worker, if included)
```

Open [http://localhost:3000](http://localhost:3000).
