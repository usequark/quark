# Deploying to Railway

This guide covers deploying a Quark project to Railway using the built-in `quark deploy railway` command.

Railway uses **Infrastructure as Code** (IaC) via `.railway/railway.ts` to define service configuration. The deploy command generates this file, installs the Railway SDK, and applies the configuration with `railway config apply`.

---

## Prerequisites

- **Railway CLI** installed and authenticated:
  ```bash
  npm install -g @railway/cli
  # or
  brew install railwayhq/brew/railway

  railway login
  ```
- **A Quark project** scaffolded via `@usequark/quark-create-app`
- **PostgreSQL and Redis** - the deploy command can provision these automatically, or you can add them manually from the Railway dashboard first and use `--no-provision` to skip.

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
5. Generates `.railway/railway.ts` (IaC configuration)
6. Installs the Railway SDK (`railway` npm package)
7. Applies IaC configuration via `railway config apply`
8. Sets remaining environment variables
9. Verifies deployment status and runs health checks

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

Runs the inspection and validation logic - checks that your `apps/web/package.json` and `apps/worker/package.json` exist, that Railway CLI is installed and logged in, and that the project structure is valid. Outputs a readiness report and exits without creating anything on Railway.

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
Looks for `apps/web/package.json` and `apps/worker/package.json`. The **web** service is always required. The **worker** service is optional - if its `package.json` is missing, it's skipped with a diagnostic warning rather than a hard failure.

For each discovered service, the CLI records:
- Service kind (`web` or `worker`)
- Relative root directory
- Package name from `package.json`
- Runtime entrypoint and health check path

### 4. Project creation / linking
- If the project is already linked (`.railway/config.json` exists and `railway status` succeeds), it uses the existing link.
- If `--project-id` is provided, runs `railway link --project <id>`.
- If `--project-name` is provided (or defaults to the directory name), checks for an existing project with that name via `railway list --json`. If found, links to it. If not, runs `railway init --name <name> --json` to create it, with one retry for transient API failures.

### 5. Plugin provisioning (Postgres + Redis)
Unless `--no-provision` is passed:
- Runs `railway add --database postgres --json` and `railway add --database redis --json`.
- If a plugin already exists, it's detected and skipped gracefully.
- The plugin service names (e.g. `Postgres`, `Redis`) are captured for use in variable references.

### 6. Secret preservation
Before generating IaC, the CLI checks if `AUTH_SECRET` and `NEXTAUTH_SECRET` already exist on the first service. If found, the existing values are reused. If not, new secrets are generated. These are embedded in the IaC file as `preserve()` so Railway keeps the managed values.

### 7. IaC file generation
The CLI generates `.railway/railway.ts` at the project root. This file:
- Defines both `web` and `worker` services with their build, start, and preDeploy commands
- Uses `preserve()` for secrets (AUTH_SECRET, NEXTAUTH_SECRET)
- References provisioned databases via `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}`
- Omits `source` so the CLI deploy flow manages settings without overwriting a linked GitHub/Docker source
- Escapes all user-supplied strings to prevent invalid TypeScript

### 8. Railway SDK installation
Installs the `railway` npm package as a devDependency. This is required for `railway config apply` to evaluate the TypeScript IaC file. If installation fails, the deploy aborts with an actionable error message.

### 9. IaC configuration apply
Runs `railway config apply --yes` which:
- Evaluates `.railway/railway.ts`
- Compares the desired state with the current Railway environment
- Creates or updates services, databases, and configuration
- Triggers deployments for changed services

This runs **before** variable setting to prevent double deploys.

### 10. Variable setting
Sets remaining environment variables that cannot be represented in IaC:
- Railway reference strings (`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`)
- Auto-generated secrets (AUTH_SECRET, NEXTAUTH_SECRET)
- Service-specific overrides (APP_NAME, WORKER_CONCURRENCY, etc.)

### 11. Deployment status verification
After IaC apply, the CLI checks each service's deployment status via `railway deployment list`. Services with `CRASHED` or `FAILED` status are reported as failed. For the web service, an HTTP health check against `/api/health` verifies the service is reachable.

### 12. Summary
Outputs a per-service success/failure table with health status and prints next steps:
1. Configure custom domains in the Railway dashboard
2. Run `quark deploy status` to check current service state

---

## Architecture

Quark deploys as a **two-service project** on Railway, managed by a single IaC file:

```
my-project/
├── .railway/
│   └── railway.ts          # IaC configuration (single source of truth)
├── apps/
│   ├── web/                # Next.js 16 web service
│   └── worker/             # BullMQ background worker
├── packages/
│   └── ...                 # Shared packages
└── ...
```

Railway project:
```
Railway Project
├── Postgres (plugin)
├── Redis (plugin)
├── web (service)
└── worker (service)
```

### IaC file (`.railway/railway.ts`)

```typescript
import { defineRailway, project, service } from "railway/iac";

export default defineRailway(() => {
  const web = service("web", {
    build: "pnpm install --frozen-lockfile && pnpm db:generate && pnpm --dir apps/web build:deploy",
    start: "HOSTNAME=0.0.0.0 pnpm --dir apps/web start:deploy",
    preDeploy: "pnpm db:migrate:deploy",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    env: {
      DATABASE_URL: "${{Postgres.DATABASE_URL}}",
      REDIS_URL: "${{Redis.REDIS_URL}}",
      NODE_ENV: "production",
      AUTH_SECRET: preserve(),
      NEXTAUTH_SECRET: preserve(),
      // ... other variables
    },
  });

  const worker = service("worker", {
    build: "pnpm install --frozen-lockfile && pnpm db:generate",
    start: "pnpm --dir apps/worker start:deploy",
    preDeploy: "pnpm db:migrate:deploy",
    env: {
      DATABASE_URL: "${{Postgres.DATABASE_URL}}",
      REDIS_URL: "${{Redis.REDIS_URL}}",
      NODE_ENV: "production",
      AUTH_SECRET: preserve(),
      NEXTAUTH_SECRET: preserve(),
      // ... other variables
    },
  });

  return project("my-project", {
    resources: [web, worker],
  });
});
```

Key design decisions:
- **`preserve()`** for secrets - Railway keeps existing managed values, never writing them to source
- **`preDeploy`** runs `pnpm db:migrate:deploy` before traffic switches
- **No `source`** - the CLI deploy flow manages settings without declaring a GitHub/Docker source
- **`${{Postgres.DATABASE_URL}}`** - Railway runtime references that resolve to actual connection strings

---

## Environment Variables

### Set by IaC configuration

These are defined in `.railway/railway.ts` and applied via `railway config apply`:

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway plugin reference |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Railway plugin reference |
| `NODE_ENV` | `production` | |
| `AUTH_SECRET` | `preserve()` | Railway-managed, preserved across deploys |
| `NEXTAUTH_SECRET` | `preserve()` | Railway-managed, preserved across deploys |

### Set by deploy CLI (post-apply)

These are set via `railway variable set` after IaC apply:

| Variable | Source | Notes |
|---|---|---|
| `APP_NAME` | Directory name | e.g. `my-project` |
| `APP_DESCRIPTION` | Generated | e.g. `"my-project - Quark application"` |
| `STORAGE_PROVIDER` | `local` | Change to `s3`, `r2`, etc. for production |
| `AUTH_ALLOW_SIGNUP` | `false` | Web service only. Set to `true` to allow registration |
| `HOSTNAME` | `0.0.0.0` | Web service only. Required for container platforms |
| `WORKER_CONCURRENCY` | `5` | Worker service only |

### Must configure manually

These are not set by the deploy command and must be configured in the Railway dashboard or via the CLI:

| Variable | Reason |
|---|---|
| `APP_URL` | Your custom domain (e.g. `https://app.example.com`). Required for auth callbacks, email links, etc. |
| Email provider vars | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` - if using email auth or notifications |
| Storage provider creds | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` - if using S3-compatible storage |
| Any `NEXT_PUBLIC_*` vars | Public-facing variables your frontend needs at runtime |

Set them via:

```bash
railway variable set APP_URL=https://myapp.railway.app --service web
railway variable set SMTP_HOST=smtp.sendgrid.net --service web
```

Or use the Railway dashboard: Project > Variables > New Variable.

---

## Post-Deploy

### Custom domains

```bash
railway domain --service web myapp.com
```

Or add them in the Railway dashboard under the web service's "Domains" section. Railway handles TLS provisioning automatically via Let's Encrypt.

### GitHub auto-deploy

To enable automatic deploys on push to GitHub:

1. **Add `source` to your IaC file** - edit `.railway/railway.ts` and add the `source` field to each service:

   ```typescript
   import { defineRailway, github, project, service } from "railway/iac";

   export default defineRailway(() => {
     const web = service("web", {
       source: github("your-org/your-repo", { rootDirectory: "apps/web" }),
       // ... rest of config
     });

     const worker = service("worker", {
       source: github("your-org/your-repo", { rootDirectory: "apps/worker" }),
       // ... rest of config
     });

     return project("my-project", { resources: [web, worker] });
   });
   ```

2. **Connect the repository** in Railway dashboard → Project Settings → Git Integration

3. **Apply the IaC change**:
   ```bash
   railway config apply
   ```

4. Future pushes to the connected branch trigger automatic redeploys

> **Note:** Without `source`, the CLI deploy flow (`quark deploy railway`) manages settings without declaring a repository. This is the default for initial deploys.

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

### Per-environment IaC configuration

The IaC file receives a context object with the current environment name, allowing per-environment configuration:

```typescript
import { defineRailway, project, service } from "railway/iac";

export default defineRailway((ctx) => {
  const prod = ctx.environment === "production";

  const web = service("web", {
    // ... base config
    env: {
      NODE_ENV: "production",
      AUTH_ALLOW_SIGNUP: prod ? "false" : "true",
    },
  });

  return project("my-project", { resources: [web] });
});
```

### Tag-based promotion

Railway's [deployment promotions](https://docs.railway.com/deploy/deployments#promoting-a-deployment) let you tag a production deployment and then promote it to other environments. This is managed through the Railway dashboard or CLI directly, not through the Quark deploy command.

---

## Migrating from Config as Code

Railway's Config as Code (`railway.json` / `railway.toml`) is **deprecated** with a hard cutoff on **2026-12-01**. New projects use IaC (`.railway/railway.ts`) by default.

### Automatic migration

Run in your project root:

```bash
railway config migrate --apply --delete-files
```

This converts all `railway.json` files into a single `.railway/railway.ts`.

### Manual migration

1. Review the current IaC file at `.railway/railway.ts` (generated by `quark deploy railway`)
2. Translate any custom settings from your `railway.json` files into the IaC DSL
3. Delete the old `railway.json` files
4. Apply: `railway config apply`

### What changed

| Before (Config as Code) | After (IaC) |
|---|---|
| `apps/web/railway.json` + `apps/worker/railway.json` | Single `.railway/railway.ts` |
| Per-service `railway.json` files | One project-level IaC file |
| `railway up --service <name>` | `railway config apply` |
| Secrets set via `railway variable set` | Secrets use `preserve()` in IaC |
| `releaseCommand` for migrations | `preDeploy` for migrations |

---

## Troubleshooting

**Deploy fails with "Railway CLI not found"**
Install the CLI: `npm install -g @railway/cli` or `brew install railwayhq/brew/railway`

**Deploy fails with "Not logged into Railway"**
Run `railway login` to authenticate.

**Deploy fails with "Project discovery failed"**
Run `quark deploy inspect` to see diagnostics. Common causes: `apps/web/package.json` is missing, or the project isn't a valid Quark scaffold.

**Deploy fails with "Railway SDK installation failed"**
Run `pnpm add -D railway` manually. The generated IaC file imports from `railway/iac` which requires this package.

**Deploy fails with "IaC apply failed"**
Run `railway config plan` to preview what would change. Common causes: conflicting service definitions, invalid variable references, or the `.railway/railway.ts` file has syntax errors.

**Web service deploys but returns connection refused**
Check that `HOSTNAME=0.0.0.0` is set and that Railway provides the `PORT` environment variable. The startup command already binds to `0.0.0.0` in the IaC configuration.

**Health check times out**
The deploy waits 60 seconds after deployment for `/api/health` to respond with HTTP 200. If it times out, check the web service logs in the Railway dashboard. The health check endpoint is defined at `apps/web/src/app/api/health/route.js`.

**"Variables could not be set" warning**
The deploy continues even if variable setting partially fails. Run `railway variable set KEY=VALUE --service <name>` manually to fix missing variables.

**Worker fails to start**
Workers don't have health checks or domains. Check the worker service logs in the dashboard. Common issues: missing Redis connection, job handler errors, missing `WORKER_CONCURRENCY`, or database schema not ready (the worker waits for DB readiness before processing jobs).
