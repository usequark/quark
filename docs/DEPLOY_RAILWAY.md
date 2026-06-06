# Deploying to Railway

This guide covers deploying a Quark project to Railway using the built-in `quark deploy railway` command.

---

## Prerequisites

- **Railway CLI** installed and authenticated:
  ```bash
  npm install -g @railway/cli
  # or
  brew install railwayhq/brew/railway

  railway login
  ```
- **A Quark project** scaffolded via `@techstream/quark-create-app`
- **PostgreSQL and Redis** — the deploy command can provision these automatically, or you can add them manually from the Railway dashboard first and use `--no-provision` to skip.

---

## Quick Start

```bash
cd my-quark-project
quark deploy railway
```

That single command:
1. Verifies the Railway CLI and login
2. Discovers your web and worker services
3. Creates a Railway project (or links to an existing one)
4. Provisions PostgreSQL and Redis plugins
5. Sets required environment variables
6. Deploys both services
7. Runs a health check against the web service

---

## Commands Reference

### Full deploy

```bash
quark deploy railway
```

Deploys web + worker services, provisions Postgres + Redis, and sets environment variables. Equivalent to a complete project bootstrap on Railway.

### Dry run (validate without deploying)

```bash
quark deploy railway --dry-run
```

Runs the inspection and validation logic — checks that your `apps/web/package.json` and `apps/worker/package.json` exist, that Railway CLI is installed and logged in, and that all per-service `railway.json` files are present. Outputs a readiness report and exits without creating anything on Railway.

### Inspect / status

```bash
quark deploy inspect
# or
quark deploy status
```

Two aliases for the same `inspectProject` function. Shows:
- Discovered services and their entrypoints
- Diagnostics (e.g. missing required services)
- Railway CLI version and login status
- Whether the project is linked to a Railway project
- Deployed service domains (if linked)
- Per-service deployment status with links to the Railway dashboard

### Options

| Option | Description |
|---|---|
| `--project-name <name>` | Railway project name. Creates a new project. Defaults to the directory name. |
| `--project-id <id>` | Link to an existing Railway project by ID instead of creating a new one. |
| `--environment <env>` | Target environment (e.g. `production`, `staging`). Defaults to `production`. |
| `--no-provision` | Skip provisioning PostgreSQL and Redis plugins. Use if you've already added them in the Railway dashboard. |
| `--dry-run` | Validate configuration and check readiness without deploying. |

### Examples

```bash
# Deploy with a custom project name
quark deploy railway --project-name my-app-prod

# Deploy to an existing Railway project
quark deploy railway --project-id xyz123

# Deploy to staging environment (Postgres/Redis already provisioned)
quark deploy railway --environment staging --no-provision

# Check if everything is ready before deploying
quark deploy railway --dry-run
```

---

## What Happens During Deploy

The deploy proceeds through these steps:

### 1. CLI check
Verifies `railway --version` works. If not found, prints install instructions for npm and Homebrew.

### 2. Login check
Runs `railway whoami` and extracts the authenticated email. If not logged in, prompts you to run `railway login`.

### 3. Service discovery
Looks for `apps/web/package.json` and `apps/worker/package.json`. The **web** service is always required. The **worker** service is optional — if its `package.json` is missing, it's skipped with a diagnostic warning rather than a hard failure.

For each discovered service, the CLI records:
- Service kind (`web` or `worker`)
- Relative root directory
- Package name from `package.json`
- Runtime entrypoint and health check path

### 4. Pre-deploy validation
Checks that every discovered service has a `railway.json` in its root directory (`apps/web/railway.json`, `apps/worker/railway.json`). Fails fast if any are missing.

### 5. Project creation / linking
- If the project is already linked (`.railway/config.json` exists and `railway status` succeeds), it uses the existing link.
- If `--project-id` is provided, runs `railway link --project <id>`.
- If `--project-name` is provided (or defaults to the directory name), checks for an existing project with that name via `railway list --json`. If found, links to it. If not, runs `railway init --name <name> --json` to create it, with one retry for transient API failures.

### 6. Plugin provisioning (Postgres + Redis)
Unless `--no-provision` is passed:
- Runs `railway add --database postgres --json` and `railway add --database redis --json`.
- If a plugin already exists, it's detected and skipped gracefully.
- The plugin service names (e.g. `Postgres`, `Redis`) are captured for use in variable references.

### 7. Variable setting
For each service, the deploy command sets environment variables using a single `railway variable set` call per service with `--skip-deploys`:

**Shared (both services):**
| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `APP_NAME` | Directory name |
| `APP_DESCRIPTION` | `"<name> — Quark application"` |
| `NODE_ENV` | `production` |
| `AUTH_SECRET` | Auto-generated or preserved from previous deploys |
| `NEXTAUTH_SECRET` | Auto-generated or preserved from previous deploys |
| `STORAGE_PROVIDER` | `local` |

**Web service only:**
| Variable | Value |
|---|---|
| `AUTH_ALLOW_SIGNUP` | `false` |
| `HOSTNAME` | `0.0.0.0` |

**Worker service only:**
| Variable | Value |
|---|---|
| `WORKER_CONCURRENCY` | `5` |

Secrets are **preserved across deploys** — `AUTH_SECRET` and `NEXTAUTH_SECRET` are checked from the first service before generating new ones, so you don't break existing sessions when redeploying.

### 8. Temporary multi-service railway.json
The CLI reads each service's individual `railway.json` (e.g. `apps/web/railway.json`, `apps/worker/railway.json`) and writes a merged multi-service `railway.json` at the project root. This temporary file is deleted in a `finally` block after deployment completes. If the root already had a `railway.json` (config-as-code path), it is left untouched.

### 9. Service deployment
For each service, in order:
- **`railway add --service <name>`** — creates the Railway service if it doesn't exist
- **`railway up --service <name> --detach`** — triggers a deployment and polls every 5 seconds for up to 10 minutes
- Deployment status is polled via `railway deployment list --json` looking for `SUCCESS` or `HEALTHY`. Crashed/failed deployments throw immediately. Timeout after 10 minutes.
- **Health check** — for the web service, hits `/api/health` every 3 seconds for up to 60 seconds, waiting for an HTTP 200 response.
- **Worker domain removal** — Railway assigns a default domain to every service. Since workers don't serve HTTP, the deploy command removes the worker's domain via `railway domain remove`.

### 10. Rollback
If a service is newly created (not just linked) and its deployment fails, the CLI deletes the Railway service to avoid leaving behind half-deployed infrastructure.

### 11. Summary
Outputs a per-service success/failure table and prints next steps:
1. Configure custom domains in the Railway dashboard
2. Connect GitHub for auto-deploys on push
3. Run `quark deploy status` to check current service state

---

## Architecture

Quark deploys as a **two-service project** on Railway:

```
Railway Project
├── Postgres (plugin)
├── Redis (plugin)
├── web (service)
│   └── apps/web/railway.json
└── worker (service)
    └── apps/worker/railway.json
```

### Web service (`apps/web/railway.json`)

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm db:generate && pnpm --dir apps/web build:deploy",
    "watchPatterns": ["apps/web/**", "packages/**"]
  },
  "deploy": {
    "releaseCommand": "pnpm db:migrate:deploy",
    "startCommand": "HOSTNAME=0.0.0.0 pnpm --dir apps/web start:deploy",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

- **Builder:** RAILPACK (Railway's build system, Nixpacks-compatible)
- **Build:** Installs dependencies, generates Prisma client, builds the Next.js standalone output
- **Release:** Runs database migrations before the new deployment starts receiving traffic
- **Start:** Launches the Next.js standalone server bound to `0.0.0.0`
- **Health check:** Railway polls `/api/health` every 120 seconds before marking the deployment healthy

### Worker service (`apps/worker/railway.json`)

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm db:generate",
    "watchPatterns": ["apps/worker/**", "packages/**"]
  },
  "deploy": {
    "startCommand": "pnpm --dir apps/worker start:deploy",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  },
  "release": {
    "command": "pnpm db:migrate:deploy"
  }
}
```

- Similar build process, but no Next.js build step
- Release command runs migrations before the worker starts
- No health check or domain (domains are removed by the deploy command)

### Root railway.json (temporary)

During deployment, a merged multi-service root `railway.json` is created and then cleaned up. If a root `railway.json` already exists (e.g. from a prior "Config as Code Path" setup), it is preserved and not overwritten.

---

## Environment Variables

### Auto-set by the deploy command

These are set via `railway variable set` during deployment using Railway's `${{Plugin.VARIABLE}}` reference syntax:

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway plugin reference |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Railway plugin reference |
| `AUTH_SECRET` | Auto-generated | Preserved across redeploys |
| `NEXTAUTH_SECRET` | Auto-generated | Preserved across redeploys |
| `APP_NAME` | Directory name | e.g. `my-project` |
| `APP_DESCRIPTION` | Generated | e.g. `"my-project — Quark application"` |
| `NODE_ENV` | `production` | |
| `STORAGE_PROVIDER` | `local` | Change to `s3`, `r2`, etc. for production |
| `AUTH_ALLOW_SIGNUP` | `false` | Web service only. Set to `true` to allow registration |
| `HOSTNAME` | `0.0.0.0` | Web service only. Required for container platforms |
| `WORKER_CONCURRENCY` | `5` | Worker service only |

### Must configure manually

These are not set by the deploy command and must be configured in the Railway dashboard or via the CLI:

| Variable | Reason |
|---|---|
| `APP_URL` | Your custom domain (e.g. `https://app.example.com`). Required for auth callbacks, email links, etc. |
| Email provider vars | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` — if using email auth or notifications |
| Storage provider creds | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` — if using S3-compatible storage |
| Any `NEXT_PUBLIC_*` vars | Public-facing variables your frontend needs at runtime |

Set them via:

```bash
railway variable set APP_URL=https://myapp.railway.app --service web
railway variable set SMTP_HOST=smtp.sendgrid.net --service web
```

Or use the Railway dashboard: Project > Variables > New Variable.

---

## Post-Deploy

### Config as Code Path

After the initial deploy, configure Railway's "Config as Code Path" per service so that future deploys (especially GitHub auto-deploys) use the correct `railway.json`:

| Service | Config as Code Path |
|---|---|
| web | `apps/web/railway.json` |
| worker | `apps/worker/railway.json` |

To set this:
1. Open your Railway project dashboard
2. Navigate to each service's Settings tab
3. Under "Config as Code Path", enter the path above

Once set, Railway will read build/deploy configuration from these files instead of requiring manual configuration.

### Custom domains

```bash
railway domain --service web myapp.com
```

Or add them in the Railway dashboard under the web service's "Domains" section. Railway handles TLS provisioning automatically via Let's Encrypt.

### GitHub integration

1. Railway dashboard → Project Settings → Git Integration → Connect repository
2. Select your repo and branch (usually `main`)
3. For each service, set the Config as Code Path (see above)
4. Future pushes to the branch trigger automatic redeploys

Railway builds from the monorepo root. The `watchPatterns` in each `railway.json` control which file changes trigger a build. For example, `apps/web/railway.json` watches `apps/web/**` and `packages/**` — changes to the worker or other apps won't rebuild the web service.

### Checking deploy status

```bash
quark deploy status
```

Shows each Railway service with its current status (`deployed`, `deploying`, `crashed`, etc.) and a link to the Railway dashboard for detailed logs.

---

## Working with Environments

Railway supports multiple environments (production, staging, preview). Use the `--environment` flag to target a specific environment:

```bash
# Deploy to staging
quark deploy railway --environment staging

# Deploy to production explicitly
quark deploy railway --environment production
```

When an environment is specified, all subsequent `railway` commands (variable set, deployment, service operations) include `--environment <env>`, so variables and deployments are scoped to that environment.

### Tag-based promotion

Railway's [deployment promotions](https://docs.railway.com/deploy/deployments#promoting-a-deployment) let you tag a production deployment and then promote it to other environments. This is managed through the Railway dashboard or CLI directly, not through the Quark deploy command.

---

## Troubleshooting

**Deploy fails with "Railway CLI not found"**
Install the CLI: `npm install -g @railway/cli` or `brew install railwayhq/brew/railway`

**Deploy fails with "Not logged into Railway"**
Run `railway login` to authenticate.

**Deploy fails with "Project discovery failed"**
Run `quark deploy inspect` to see diagnostics. Common causes: `apps/web/package.json` is missing, or the project isn't a valid Quark scaffold.

**Web service deploys but returns connection refused**
Check that `HOSTNAME=0.0.0.0` is set and that Railway provides the `PORT` environment variable. The startup command already binds to `0.0.0.0` in the default `railway.json`.

**Health check times out**
The deploy waits 60 seconds after deployment for `/api/health` to respond with HTTP 200. If it times out, check the web service logs in the Railway dashboard. The health check endpoint is defined at `apps/web/src/app/api/health/route.js`.

**"Variables could not be set" warning**
The deploy continues even if variable setting partially fails. Run `railway variable set KEY=VALUE --service <name>` manually to fix missing variables.

**Worker fails to start**
Workers don't have health checks or domains. Check the worker service logs in the dashboard. Common issues: missing Redis connection, job handler errors, or missing `WORKER_CONCURRENCY`.
