# __QUARK_PROJECT_NAME__

Scaffolded with [Quark](https://github.com/usequark/quark) on __QUARK_SCAFFOLD_DATE__.

## Start Here

- `docs/START_HERE.md` - current onboarding path for this project
- `docs/FIRST_FEATURE.md` - add your first domain model, query helper, and page
- `.opencode/skills/` - embedded skills (add a model, endpoint, dashboard, or build a booking/CRM/CMS/AI system)
- `CLAUDE.md` - AI tool context for Claude Code, Cursor, Copilot, and others

## Local Development

```bash
docker compose up -d   # Start PostgreSQL, Redis, Mailpit
pnpm install           # Install dependencies
pnpm db:migrate        # Apply migrations
pnpm db:seed           # Seed the database (admin user + sample data)
pnpm dev               # Start the app (and worker, if included)
```

Open [http://localhost:3000](http://localhost:3000)

## UI References

- `apps/web/src/app/page.js` - production-style public page built from the shared UI package
- `packages/ui/README.md` - supported component surface and props

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

### PWA (Optional)

When enabled, your app includes:
- `src/app/manifest.json` — web app manifest for installability (served natively by Next.js)
- `public/sw.js` — vanilla service worker with cache-first static assets and network-first navigation
- `src/app/_components/PWARegister.js` — client component that registers the SW in production

Edit `manifest.json` to set your app name, theme color, and icons.
The service worker uses standard Web APIs with no external dependencies.

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
pnpm clean:check  # Review reclaimable build artifacts
pnpm clean        # Remove local build artifacts
pnpm clean:deep   # Also remove repo-local temp workspaces
QUARK_SKIP_AUTO_CLEAN=1 pnpm dev  # Disable dev auto-clean for this run
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

> **Nested inside an existing repository?** GitHub Actions only reads workflow
> files from the repository root, so this project's `.github/workflows/*.yml`
> will be ignored. Copy them into the parent repository's
> `.github/workflows/` and add `working-directory: <path-to-this-project>` to
> each job's steps (plus path filters so the workflows only run on changes in
> this directory).

### 2. Deploy on Railway

> **One-click Railway template coming soon.** For now, follow these steps:

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select `__QUARK_PROJECT_NAME__`
2. In the service → **Settings** → **Source**:
   - Set **Root Directory** to `/` (the repo root - Railpack needs the full monorepo context to resolve workspace dependencies)
3. In the project → **+ New** → **Database** → **Add PostgreSQL**
4. In the project → **+ New** → **Database** → **Add Redis**
5. Use `.env.railway.example` as the default Railway variable set:
   - Copy the non-service defaults into Railway shared variables or each service's variables as your starting point
   - Wire `DATABASE_URL` and `REDIS_URL` with Railway service references or paste the managed service connection strings Railway provides
   - Replace `NEXTAUTH_SECRET`, `APP_URL`, and `ADMIN_PASSWORD`
   - `HOSTNAME=0.0.0.0` is included so the standalone Next server binds correctly on Railway
   - Apply `DATABASE_URL`, `REDIS_URL`, `STORAGE_PROVIDER`, and `WORKER_CONCURRENCY` to the worker too if you deploy it
6. *(If you included the worker)* **+ New** → **GitHub Repo** → same repo → **Root Directory** → `/`

Railway auto-deploys on every push to `main`. Migrations run automatically before each deploy via `preDeploy` in `.railway/railway.ts`.

If you need to seed Railway manually after the first migration, run `SEED_PROFILE=minimal pnpm db:seed` inside a Railway shell/one-off command, or from a machine using Railway's externally reachable database credentials, and provide the required admin credentials. The seed guard rejects remote seeds without an explicit profile on purpose.

> **Important:** Root Directory must be `/` (not `apps/web`) so Railpack can resolve pnpm workspace dependencies. The `.railway/railway.ts` file defines all service configuration via Infrastructure as Code.
>
> Railway starts the web service with `HOSTNAME=0.0.0.0 pnpm --dir apps/web start:deploy` (configured in `.railway/railway.ts`), which delegates to the standalone entrypoint `node .next/standalone/apps/web/server.js`. This forces the standalone Next server to bind on Railway's network interface. The `pnpm start` script uses `next start` which requires full `node_modules` - it's for local testing only.

## AI-Assisted Development

This project ships with pre-loaded context for Claude Code, Cursor, GitHub Copilot, and others - see `CLAUDE.md` for the full reference.

**Suggested first prompt:**

> I'm building __QUARK_PROJECT_NAME__ - [describe what your app does in one sentence].
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
└── CLAUDE.md        # AI tool context - keep this updated
```
