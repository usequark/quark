# __QUARK_PROJECT_NAME__

Scaffolded with [Quark](https://github.com/Bobnoddle/quark) on __QUARK_SCAFFOLD_DATE__.

## Local Development

```bash
docker compose up -d   # Start PostgreSQL, Redis, Mailpit
pnpm install           # Install dependencies
pnpm db:migrate        # Apply migrations
pnpm dev               # Start web + worker
```

Open [http://localhost:3000](http://localhost:3000)

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
2. In the service → **Settings** → **Source** → set **Config File** to `apps/web/railway.json`
3. In the project → **+ New** → **Database** → **Add PostgreSQL** (injects `DATABASE_URL` automatically)
4. In the project → **+ New** → **Database** → **Add Redis** (injects `REDIS_URL` automatically)
5. In your web service → **Variables** → add:
   - `NEXTAUTH_SECRET` → run `openssl rand -base64 32` locally and paste the result
   - `APP_URL` → your Railway public domain (e.g. `https://__QUARK_PROJECT_NAME__.railway.app`)
6. *(If you included the worker)* **+ New** → **GitHub Repo** → same repo → **Config File** → `apps/worker/railway.json`

Railway auto-deploys on every push to `main`. Migrations run automatically before each deploy.

## AI-Assisted Development

This project ships with pre-loaded context for Claude Code, Cursor, GitHub Copilot, and others — see `CLAUDE.md` for the full reference.

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
│   └── worker/      # BullMQ background worker
├── packages/
│   ├── db/          # Prisma schema + query helpers
│   └── config/      # Environment validation
├── docker-compose.yml
└── CLAUDE.md        # AI tool context — keep this updated
```
