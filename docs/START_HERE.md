# Start Here

This is the **current onboarding path** for Quark.

Use this guide if you are about to scaffold a project, have just scaffolded one, or want the shortest path from "new repo" to "working feature" without digging through reference docs first.

## Choose your path

| I want to... | Start with |
|---|---|
| Build a new product with Quark | [README.md](../README.md) -> this guide -> [FIRST_FEATURE.md](./FIRST_FEATURE.md) |
| Contribute to the Quark monorepo | [README.md](../README.md), `AGENTS.md`, `copilot-instructions.md` |
| Look up exact platform behavior | `DATABASE.md`, `API.md`, `SECURITY_FEATURES.md`, `QUARK_USAGE.md` |

## Scaffold a project

```bash
npx @usequark/quark-create-app@latest my-project
cd my-project
docker compose up -d
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`.

Then open `MAIN.md` in the scaffolded project - it is the "read this first" entry point for you and your AI tool, routing to `CLAUDE.md`, `docs/`, `openapi.yaml`, and the embedded skills (placed per your `--harness` choice, default `.opencode/skills/`).

## Know what Quark gives you

Quark always gives you:

- `apps/web` - the Next.js app
- `packages/db` - Prisma schema, client, and query helpers
- `packages/config` - validated environment config
- `@usequark/quark-core` - auth, queues, validation, logging, errors, storage, metrics

Optional scaffolded features:

| Feature | What it adds | Best starting point |
|---|---|---|
| `jobs` | Local job definitions + `apps/worker` | `packages/jobs/README.md` |
| `pwa` | Progressive web app manifest and service worker setup | scaffolded project docs |

`mobile` (an Expo app) is **not** available at create time. Add it afterwards with `npx quark add mobile`.

`ui` is always scaffolded, so you do not need to select it. Add any of the above later with `npx quark add <feature>`.

Domain systems are not scaffolded features. Every scaffold ships embedded skills that teach your AI tool to build them on demand:

| Skill | Builds |
|---|---|
| `payment` | Stripe payments, checkout, webhooks, fulfillment |
| `ecommerce` | Catalog, cart, checkout, orders, inventory (with `ecommerce-catalog`, `ecommerce-cart`, `ecommerce-checkout`) |
| `i18n` | Locale routing, translated content, hreflang SEO |
| `add-model` | Prisma model + query helpers + tests |
| `add-endpoint` | API route or Server Action with Zod, CSRF, role guards |
| `add-dashboard` | Metrics overview page |

Read the skill index in `<harness>/skills/` (default `.opencode/skills/`) before asking your AI tool to build one of these.

---

## Deploy

```bash
npx quark deploy railway
```

This generates `.railway/railway.ts`, provisions PostgreSQL and Redis, and deploys `web` and `worker` with migrations running before traffic switches. Railway is the only supported deploy target today.

📖 **Full guide: [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)**

## Learn the project layout fast

Start with these files:

1. `packages/db/prisma/schema.prisma` - your domain models
2. `packages/db/src/queries.js` - reusable data access helpers
3. `apps/web/src/app/` - pages, route handlers, and Server Actions
4. `apps/web/src/lib/auth.js` - auth wiring and providers
5. `apps/worker/src/handlers/` - background job handlers, if you included `jobs`

## Build your first real feature

Follow **[FIRST_FEATURE.md](./FIRST_FEATURE.md)** next.

That guide covers the standard Quark flow:

1. add a Prisma model
2. run `pnpm db:generate` and `pnpm db:migrate`
3. add query helpers
4. build a page or mutation flow
5. add a test near the changed code

## Use the right docs for the right job

This is the docs contract for Quark:

| Doc | Purpose |
|---|---|
| `README.md` | Product overview, quick start, and what ships today |
| `docs/START_HERE.md` | Current onboarding path |
| `docs/FIRST_FEATURE.md` | Canonical first feature walkthrough |
| `packages/*/README.md` | Optional feature guides and extension points |
| `DEPLOY_RAILWAY.md` | Deployment, environment variables, and troubleshooting |
| `DATABASE.md`, `API.md`, `SECURITY_FEATURES.md` | Reference material |
| `DESIGN_NOTES.md` | Current architecture direction |
| `docs/archive/` | Historical planning material, not current guidance |

If a detail appears in both onboarding and reference docs, treat the onboarding docs as the **shortest current path** and the reference docs as the **deeper explanation**.
