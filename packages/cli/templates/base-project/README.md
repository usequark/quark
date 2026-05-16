# __QUARK_PROJECT_NAME__

Scaffolded with [Quark](https://github.com/Bobnoddle/quark) on __QUARK_SCAFFOLD_DATE__.

## Start Here

- `docs/START_HERE.md` - current onboarding path for this project
- `docs/FIRST_FEATURE.md` - add your first domain model, query helper, and page
- `CLAUDE.md` - AI tool context for Claude Code, Cursor, Copilot, and others

## Local Development

```bash
docker compose up -d   # Start PostgreSQL, Redis, Mailpit
pnpm install           # Install dependencies
pnpm db:migrate        # Apply migrations
pnpm dev               # Start the app (and worker, if included)
```

Open [http://localhost:3000](http://localhost:3000)

## Included in This Project

| Area | Status | Where to start |
|---|---|---|
| Web app | Included | `apps/web/src/app/` |
| Database | Included | `packages/db/prisma/schema.prisma` |
| Config | Included | `packages/config/src/load-config.js` |
__QUARK_FEATURE_ROWS__

Optional features can be added later with:

```bash
npx @techstream/quark-create-app add <feature>
```

## First Files to Edit

- `packages/db/prisma/schema.prisma` - add your domain models
- `packages/db/src/queries.js` - add reusable query helpers
- `apps/web/src/app/` - build pages, Server Actions, and route handlers
__QUARK_FIRST_EDITS__

## Feature Guides

- `docs/FIRST_FEATURE.md` - the best first walkthrough for product work
- `packages/db/src/queries.js` - the canonical place for reusable data access
__QUARK_FEATURE_GUIDES__

## Database

| Task | Command |
|------|---------|
| Run migrations | `pnpm db:migrate` |
| Push schema (no migration) | `pnpm db:push` |
| Generate Prisma client | `pnpm db:generate` |
| Seed database | `pnpm db:seed` |
| Open Prisma Studio | `pnpm db:studio` |

## Other Commands

```bash
pnpm build    # Build all packages
pnpm test     # Run all tests (requires Docker)
pnpm lint     # Lint + format check (Biome)
npx @techstream/quark-create-app update --scaffold-check                 # Review scaffold-managed drift
npx @techstream/quark-create-app update --scaffold-check --fail-on-drift # CI-friendly drift check
```

## Launch

### 1. Push to GitHub

```bash
gh repo create __QUARK_PROJECT_NAME__ --private --source=. --push
```

No `gh` CLI? Go to [github.com/new](https://github.com/new), create the repo, then:

```bash
git remote add origin https://github.com/<you>/__QUARK_PROJECT_NAME__.git
git push -u origin main
```

### 2. Deploy on Railway

> **One-click Railway template coming soon.** For now, follow these steps:

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select `__QUARK_PROJECT_NAME__`
2. In the service → **Settings** → **Source**:
   - Set **Root Directory** to `/` (the repo root — Railpack needs the full monorepo context to resolve workspace dependencies)
   - Set **Config as Code Path** to `apps/web/railway.json`
3. In the project → **+ New** → **Database** → **Add PostgreSQL** (injects `DATABASE_URL` automatically)
4. In the project → **+ New** → **Database** → **Add Redis** (injects `REDIS_URL` automatically)
5. In your web service → **Variables** → add:
   - `NEXTAUTH_SECRET` → run `openssl rand -base64 32` locally and paste the result
   - `APP_URL` → your Railway public domain (e.g. `https://__QUARK_PROJECT_NAME__.railway.app`)
6. *(If you included the worker)* **+ New** → **GitHub Repo** → same repo → **Root Directory** → `/` → **Config as Code Path** → `apps/worker/railway.json`

Railway auto-deploys on every push to `main`. Migrations run automatically before each deploy.

> **Important:** Root Directory must be `/` (not `apps/web`) so Railpack can resolve pnpm workspace dependencies. The **Config as Code Path** tells Railway where to find the `railway.json` — without it, the config is silently ignored and Railway falls back to defaults.
>
> The production start command is `node apps/web/.next/standalone/apps/web/server.js` (configured in `railway.json`). The `pnpm start` script uses `next start` which requires full `node_modules` — it's for local testing only.

## AI-Assisted Development

This project ships with pre-loaded context for Claude Code, Cursor, GitHub Copilot, and others - see `CLAUDE.md` for the full reference.

**Suggested first prompt:**

> I'm building __QUARK_PROJECT_NAME__ — [describe what your app does in one sentence].
>
> Start by reviewing `CLAUDE.md` so you understand the full stack, then:
> 1. Add the Prisma models we need to `packages/db/prisma/schema.prisma`
> 2. Create the query helpers in `packages/db/src/queries.js`
> 3. Build the first page in `apps/web/src/app/` using our UI component system

Replace that bracketed description with what you're actually building, and the AI has everything it needs.

## Structure

```
__QUARK_PROJECT_NAME__/
├── apps/
│   ├── web/         # Next.js 16 (App Router, Server Actions)
__QUARK_OPTIONAL_APPS__├── packages/
│   ├── db/          # Prisma schema + query helpers
│   └── config/      # Environment validation
├── docker-compose.yml
└── CLAUDE.md        # AI tool context — keep this updated
```
