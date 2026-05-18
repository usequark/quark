# __QUARK_PROJECT_NAME__ — AI Context

> Scaffolded with [Quark](https://github.com/Bobnoddle/quark) on __QUARK_SCAFFOLD_DATE__.
> **Keep this file updated** as your project grows — it's what Claude Code, Cursor, and other AI tools read first.

## Quick Start

```bash
docker compose up -d     # Start PostgreSQL, Redis, Mailpit
pnpm install             # Install dependencies
pnpm db:generate         # Generate Prisma client
pnpm db:migrate          # Apply database migrations
pnpm db:seed             # Seed development data
pnpm dev                 # Start web + worker
```

## Scaffolding Another Project (non-interactive)

```bash
# With default features (ui + jobs):
npx @techstream/quark-create-app my-app --no-prompts

# With specific features:
npx @techstream/quark-create-app my-app --no-prompts --features ui,jobs
npx @techstream/quark-create-app my-app --no-prompts --features ui,jobs,admin,cms
npx @techstream/quark-create-app my-app --no-prompts --features ""    # minimal (db + config only)
```

## Project Structure

```
__QUARK_PROJECT_NAME__/
├── apps/
│   ├── web/                  # Next.js 16 (App Router, Server Actions)
__QUARK_OPTIONAL_APPS__├── packages/
│   ├── db/                   # Prisma schema, client, query functions
│   ├── config/               # Environment validation & shared config
__QUARK_OPTIONAL_PACKAGES__├── docker-compose.yml
├── .env                      # Local environment secrets (never commit)
└── .env.example              # Template — copy to .env to get started
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | JavaScript — ESM only, no TypeScript |
| Database | PostgreSQL 16 + Prisma 7 |
| Queue | BullMQ + Redis 7 |
| Auth | NextAuth v5 |
| Validation | Zod 4 |
| UI | Tailwind CSS + `@__QUARK_SCOPE__/ui` components |
| Email | Nodemailer (Mailpit local / Resend or Zeptomail prod) |
| Storage | Local filesystem or S3/R2 (pluggable via `STORAGE_PROVIDER`) |
| Logging | Structured logger via `createLogger()` from `@techstream/quark-core` |
| Metrics | Prometheus via `metrics` singleton from `@techstream/quark-core` |
| Testing | Node.js built-in `node --test` |
| Linting | Biome |
| Monorepo | Turborepo + pnpm workspaces |
| Deployment | Railway (web service + worker service) |

## Package Imports

```javascript
// Published (installed from npm) — use @techstream/ prefix:
import { AppError, ValidationError, NotFoundError, UnauthorizedError } from "@techstream/quark-core/errors";
import { createLogger } from "@techstream/quark-core";
import { getCurrentSession } from "@techstream/quark-core";
import { createQueue, addJob } from "@techstream/quark-core";
import { metrics } from "@techstream/quark-core";
import { cache } from "@techstream/quark-core";
import { rateLimit } from "@techstream/quark-core";
import { storage } from "@techstream/quark-core";

// Workspace packages — ALWAYS use @__QUARK_SCOPE__/* (never @techstream/quark-*):
import { prisma, user } from "@__QUARK_SCOPE__/db";         // add more as you create query helpers
import { loadConfig } from "@__QUARK_SCOPE__/config";
import { Button, Card, Input } from "@__QUARK_SCOPE__/ui";   // if ui package selected
import { JOB_NAMES } from "@__QUARK_SCOPE__/jobs";           // if jobs package selected
```

## UI & Design System

All UI components come from `@__QUARK_SCOPE__/ui`. They are Tailwind-only, dependency-free, and Server Component-safe.

**Available components:**
- `Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox` — form primitives
- `Badge` — status labels
- `Card` / `CardHeader` / `CardTitle` / `CardContent` / `CardFooter` — content containers
- `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` — data tables
- `Skeleton` — loading placeholders
- `QuarkLogo` *(server)* — inline SVG logo, dark-mode aware
- `Dialog` *(client)* — modal dialogs
- `Toast` / `useToast` *(client)* — notifications
- `ThemeProvider` / `useTheme` *(client)* — dark/light mode context

**Rules:**
- All styling via Tailwind CSS utility classes. No inline styles, no CSS modules.
- Import from `@__QUARK_SCOPE__/ui` — never from `@/components/ui/*` or direct paths.
- Every component accepts `className` for Tailwind overrides.
- Loading states → `<Skeleton>` / `<Suspense>`.
- User feedback → `useToast()` hook (client component).
- Modals → `<Dialog>` (mark parent as `"use client"`).
- Server Components are the default — only add `"use client"` when the component uses hooks, browser APIs, or the marked client components above.

## Server Actions (preferred for all mutations)

```javascript
"use server";
import { z } from "zod";
import { ValidationError, AppError } from "@techstream/quark-core/errors";
import { getCurrentSession } from "@techstream/quark-core";
import { createLogger } from "@techstream/quark-core";
import { prisma } from "@__QUARK_SCOPE__/db";

const log = createLogger("action:example");

const schema = z.object({
  title: z.string().min(1).max(255),
  body:  z.string().optional(),
});

export async function createExample(formData) {
  const session = await getCurrentSession();
  if (!session) throw new AppError("Unauthorized", 401);

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const result = await prisma.example.create({ data: parsed.data });
  log.info("created", { id: result.id });
  return result;
}
```

## API Routes

```javascript
// apps/web/src/app/api/example/route.js
import { NextResponse } from "next/server";
import { AppError } from "@techstream/quark-core/errors";
import { createLogger } from "@techstream/quark-core";

const log = createLogger("api:example");

export async function GET(request) {
  try {
    // ... logic
    return NextResponse.json({ data });
  } catch (error) {
    log.error("request failed", { error });
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

## Database

- Schema: `packages/db/prisma/schema.prisma`
- Query helpers: `packages/db/src/queries.js`
- Every model **must** include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
- After any schema change: `pnpm db:generate` then `pnpm db:migrate`.

```javascript
// Add query functions in packages/db/src/queries.js:
export const example = {
  findMany: (args) => prisma.example.findMany(args),
  findById: (id)   => prisma.example.findUnique({ where: { id } }),
  create:   (data) => prisma.example.create({ data }),
  update:   (id, data) => prisma.example.update({ where: { id }, data }),
  delete:   (id)   => prisma.example.delete({ where: { id } }),
};
```

Do not call `prisma.*` directly inside pages or Server Actions — use the query helper functions.

## Auth & Authorization

```javascript
import { getCurrentSession } from "@techstream/quark-core";

// Server Component — check session:
const session = await getCurrentSession();
if (!session) redirect("/login");

// Server Action — guard:
const session = await getCurrentSession();
if (!session) throw new AppError("Unauthorized", 401);

// Role check (ADMIN | VIEWER defined in Prisma schema):
if (session.user.role !== "ADMIN") throw new AppError("Forbidden", 403);
```

## Background Jobs (if jobs package selected)

```javascript
// 1. Dispatch from web (Server Action or API route):
import { createQueue, addJob } from "@techstream/quark-core";
import { JOB_NAMES } from "@__QUARK_SCOPE__/jobs";
const queue = createQueue("default");
await addJob(queue, JOB_NAMES.SEND_WELCOME_EMAIL, { userId: session.user.id });

// 2. Handle in apps/worker/src/handlers/<job-name>.js:
import { createLogger } from "@techstream/quark-core";
const log = createLogger("job:send-email");
export async function handleSendEmail({ data }) {
  log.info("processing", data);
  // ... job logic
}
```

## Environment Variables

Validated at startup in `packages/config/src/validate-env.js`. **Always add new env vars there before using them.**

Config loaded via `loadConfig()` from `@__QUARK_SCOPE__/config`.

Key variables:
| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `POSTGRES_*` | PostgreSQL connection |
| `REDIS_URL` / `REDIS_HOST` + `REDIS_PORT` | Redis connection |
| `NEXTAUTH_SECRET` | Auth JWT encryption (`openssl rand -base64 32`) |
| `APP_URL` | Production domain (auto-derived from `PORT` in dev) |
| `STORAGE_PROVIDER` | `local` (default) or `s3` |
| `APP_NAME` / `APP_DESCRIPTION` | Used in metadata, emails, page titles |

## Testing

```javascript
import { test } from "node:test";
import assert from "node:assert";

test("feature name", async (t) => {
  await t.test("does the thing", async () => {
    // arrange → act → assert
    assert.strictEqual(actual, expected);
  });
});
```

- Tests are co-located: `feature.test.js` lives next to `feature.js`.
- Run all: `pnpm test` | Run one package: `pnpm --filter @__QUARK_SCOPE__/web test`.
- Test utilities and model factories: `@techstream/quark-core/testing`.

## Deployment

Railway with two services: **web** (`apps/web`) and **worker** (`apps/worker`).

- Migrations run automatically on every deploy via `releaseCommand` in `apps/web/railway.json`.
- Environment variables live in Railway dashboard — never in committed files.
- Staging: auto-deploys on push to `main`. Production: deploy from a version tag.
- Generate a production seed: `SEED_PROFILE=minimal pnpm db:seed`.

### Railway Config as Code

Each service needs its **Config as Code Path** set in the Railway dashboard:

| Service | Root Directory | Config as Code Path |
|---------|---------------|---------------------|
| web | `/` | `apps/web/railway.json` |
| worker | `/` | `apps/worker/railway.json` |

Root Directory **must** be `/` so Railpack can resolve pnpm workspace dependencies. Without the Config as Code Path, Railway ignores the `railway.json` files and falls back to defaults.

The canonical production start command is `node apps/web/.next/standalone/apps/web/server.js` (set in `railway.json`). The `pnpm start` / `next start` script is for local testing only — it requires full `node_modules` and skips the standalone build.

## Key Files

| File | Purpose |
|---|---|
| `packages/db/prisma/schema.prisma` | Database schema — edit this to add models |
| `packages/db/src/queries.js` | Database query functions — add helpers here |
| `packages/config/src/validate-env.js` | Environment variable validation — register new vars here |
| `apps/web/src/app/` | Next.js pages and API routes |
| `apps/web/src/lib/auth.js` | NextAuth configuration |
| `apps/worker/src/handlers/` | Background job handler functions |
| `packages/ui/src/` | UI component source |
| `.github/skills/project-context/SKILL.md` | VS Code Copilot skill context |

---

*Update this file whenever you make structural changes: new packages, deployment targets, major new conventions, or significant architectural decisions. The AI tools you use daily depend on it being accurate.*
