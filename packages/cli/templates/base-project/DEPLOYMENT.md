# Deployment Guide

## Railway

### 1. Push to GitHub

```bash
gh repo create your-project-name --private --source=. --push
```

No `gh` CLI? Go to [github.com/new](https://github.com/new), create the repo, then:

```bash
git remote add origin https://github.com/your-username/your-project-name.git
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select `your-project-name`
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
