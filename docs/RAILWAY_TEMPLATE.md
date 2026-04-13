# Railway Template Setup Guide

This guide covers how to create and publish a Quark Railway template to the [Railway marketplace](https://railway.com/templates).

## Overview

There are two Railway templates to maintain:

| Template | Source Repo | Audience |
|---|---|---|
| **Quark Reference App** | `Bobnoddle/quark` | Contributors / evaluators |
| **Quark Starter** | `Bobnoddle/quark-starter` | End users starting a new project |

The starter template (`quark-starter`) is the primary user-facing one. The reference app template is a live demo of the Quark monorepo.

---

## 1. Creating the Quark Reference App Template

This deploys the Quark monorepo itself as a live demo.

### Step 1: Go to Railway Template Editor

Navigate to [railway.com/workspace/templates](https://railway.com/workspace/templates) → **New Template**.

### Step 2: Add Services

Add four services in this order:

#### PostgreSQL
- Click **+ New Service** → **Database** → **PostgreSQL**
- No extra config needed; Railway auto-generates `DATABASE_URL`

#### Redis
- Click **+ New Service** → **Database** → **Redis**
- No extra config needed; Railway auto-generates `REDIS_URL`

#### Web (Next.js)
- Click **+ New Service** → **GitHub Repo**
- Source repo: `https://github.com/Bobnoddle/quark`
- **Settings tab:**
  - Config file: `apps/web/railway.json`
  - Enable public networking (HTTP)
  - Health check path: `/api/health`
- **Variables tab** — add all variables from the table below

#### Worker (BullMQ)
- Click **+ New Service** → **GitHub Repo**
- Source repo: `https://github.com/Bobnoddle/quark`
- **Settings tab:**
  - Config file: `apps/worker/railway.json`
  - No public networking
- **Variables tab** — add variables from the table below

### Step 3: Configure Variables

**Web service variables:**

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference variable |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Reference variable |
| `NEXTAUTH_SECRET` | `${{secret(43, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/")}}=` | Auto-generated base64-32 secret |
| `APP_URL` | _(leave empty)_ | User fills in after Railway assigns the public domain |
| `NODE_ENV` | `production` | Static value |

> After the first deploy, Railway assigns a public domain (e.g. `quark-app.railway.app`). Users must then set `APP_URL` to `https://<their-assigned-domain>` in the service variables and redeploy. This is unavoidable — the domain is unknown before first deploy.

**Worker service variables:**

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference variable |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Reference variable |
| `NODE_ENV` | `production` | Static value |

### Step 4: Create and Publish

1. Click **Create Template**
2. Test it by deploying to your own Railway account
3. Once verified, click **Publish** and fill in:
   - Name: `Quark`
   - Description: `Full-stack JS monorepo with Next.js, Prisma, BullMQ, and NextAuth. Batteries-included auth, queues, and validation via @techstream/quark-core.`
   - Tags: `nextjs`, `prisma`, `bullmq`, `typescript`, `node`
4. Copy the template URL (e.g. `https://railway.com/new/template/XXXXXX`)

### Step 5: Add Deploy Button to README

Update the monorepo `README.md` with your actual template code:

```markdown
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/XXXXXX?utm_medium=integration&utm_source=button&utm_campaign=quark)
```

---

## 2. Creating the Quark Starter Template

This deploys a pre-scaffolded minimal Quark project — the primary user-facing template.

### Step 1: Scaffold a Starter Project

```bash
npx @techstream/quark-create-app@latest quark-starter
cd quark-starter
```

Select all options (web + worker + ui + jobs + admin) for maximum coverage.

### Step 2: Push to GitHub

```bash
gh repo create Bobnoddle/quark-starter --public --source=. --push
```

### Step 3: Create the Railway Template

Follow the same steps as Section 1 above, but with:
- Source repo: `https://github.com/Bobnoddle/quark-starter`
- Config file paths: `apps/web/railway.json` and `apps/worker/railway.json` (same as monorepo)
- Same variable configuration

### Step 4: Keeping the Starter in Sync

When Quark releases a new version, update the starter:

```bash
# In the quark-starter repo
pnpm update @techstream/quark-core@latest
pnpm db:generate
git commit -am "chore: update quark-core to vX.Y.Z"
git push
```

Railway will auto-update deployed instances that have opted into template updates.

---

## Environment Variables Reference

All required env vars for a deployed Quark app:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-injected by Railway) |
| `REDIS_URL` | Yes | Redis connection string (auto-injected by Railway) |
| `NEXTAUTH_SECRET` | Yes | Minimum 32-char secret for JWT signing |
| `APP_URL` | Recommended | Canonical app URL — sets CORS origins and NEXTAUTH_URL |
| `NODE_ENV` | Recommended | Set to `production` |
| `EMAIL_PROVIDER` | Optional | `smtp`, `resend`, or `zeptomail` |
| `SMTP_HOST` | Optional | Production SMTP host |
| `SMTP_USER` | Optional | SMTP username |
| `SMTP_PASSWORD` | Optional | SMTP password |
| `RESEND_API_KEY` | Optional | If using Resend for email |

---

## Kickback Program

Railway's [kickback program](https://docs.railway.com/templates/kickbacks) pays up to 25% of usage revenue for published open-source templates. To maximise eligibility:

- Apply for [Technology Partner](https://railway.com/partners) status
- Respond to user support questions in Central Station
- Keep the template updated with new Quark releases

---

## Checklist Before Publishing

- [ ] Template deploys cleanly end-to-end (web + worker + postgres + redis)
- [ ] `/api/health` returns 200 after deploy
- [ ] Database migrations run on first deploy
- [ ] Worker process connects to Redis and starts processing jobs
- [ ] `NEXTAUTH_SECRET` is auto-generated (not hardcoded)
- [ ] `APP_URL` propagates correctly to `NEXTAUTH_URL`
- [ ] README deploy button URL is correct
