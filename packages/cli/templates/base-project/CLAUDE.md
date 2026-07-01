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
- `ErrorBanner` — inline error feedback
- `Footer` — public site footer layout
- `Navbar` / `MobileNavbar` — public navigation shells
- `RichText` *(client)* — dependency-free rich text editor
- `QuarkLogo` *(server)* — inline SVG logo, dark-mode aware
- `Dialog` *(client)* — modal dialogs
- `Toast` / `useToast` *(client)* — notifications
- `ThemeProvider` / `useTheme` *(client)* — dark/light mode context

**Rules:**
- All styling via Tailwind CSS utility classes. No inline styles, no CSS modules.
- Import from `@__QUARK_SCOPE__/ui` — never from `@/components/ui/*` or direct paths.
- Every component accepts `className` for Tailwind overrides.
- For public-page references, inspect `apps/web/src/app/example-page/page.js`, `apps/web/src/app/playground/page.js`, and `packages/ui/README.md` before building bespoke layout primitives.
- **Loading states** → `<Skeleton>` / `<Suspense>`. Every async page that fetches from the database must have a sibling `loading.js` using `<Skeleton>` from `@__QUARK_SCOPE__/ui`.
  - **loading.js** — single-entity pages (detail, form, edit). Shows skeleton immediately, replaced when data resolves.
  - **Suspense streaming** — pages with multiple independent sections where some fetches are slower than others. Extract each section as an async server component wrapped in `<Suspense>` with a skeleton fallback.
  - **No bare `<Suspense>`** — always provide a `fallback` prop.
  - **Per-section error handling** — each streamed section should wrap data fetching in try/catch and return an error fallback rather than crashing the page.
- Run the loading-state audit to find gaps: `pnpm check:loading`.
- **Page checklist** — every new route should include:
  - `export const metadata` — title and description.
  - `loading.js` — sibling loading.js using `<Skeleton>` from `@__QUARK_SCOPE__/ui` for all async DB-fetching pages.
  - `error.js` — route-level error boundary with a user-facing fallback.
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

## Optimistic Updates (instant UI after mutations)

Use React 19's built-in `useOptimistic` or local `useState` with `startTransition`. **Never add TanStack Query, SWR, or any other caching library.** React builtins are sufficient.

### Pattern 1: `useOptimistic` for list/board data (reset on navigation)

```javascript
"use client";
import { startTransition, useOptimistic, useState } from "react";

function updateItem(items, { id, changes }) {
  return items.map((i) => (i.id === id ? { ...i, ...changes } : i));
}

export default function List({ serverItems }) {
  const [realItems, setRealItems] = useState(serverItems);
  const [optimisticItems, addOptimistic] = useOptimistic(realItems, updateItem);

  // Re-sync when server data changes (e.g., back navigation)
  useEffect(() => { setRealItems(serverItems); }, [serverItems]);

  const handleChange = (id, changes) => {
    startTransition(async () => {
      addOptimistic({ id, changes });
      try {
        await serverAction(id, changes);
        setRealItems((prev) => updateItem(prev, { id, changes }));
      } catch {
        setRealItems(serverItems); // revert to server state
      }
    });
  };

  return <div>{optimisticItems.map(renderItem)}</div>;
}
```

### Pattern 2: Local state for single-field edits (dropdowns, toggles)

```javascript
"use client";
import { startTransition, useState } from "react";

export default function StatusSelect({ serverValue, onChange }) {
  const [optimisticValue, setOptimisticValue] = useState(serverValue);

  const handleChange = (newValue) => {
    const prev = optimisticValue;
    setOptimisticValue(newValue);
    startTransition(async () => {
      try {
        await onChange(newValue);
      } catch {
        setOptimisticValue(prev); // revert on error
      }
    });
  };

  return <select value={optimisticValue} onChange={handleChange}>...</select>;
}
```

### Pattern 3: `useOptimistic` for status toggles (publishing, archiving)

```javascript
"use client";
import { startTransition, useOptimistic } from "react";

export default function StatusPanel({ record, publishAction, archiveAction }) {
  const [optimisticStatus, addOptimisticStatus] = useOptimistic(
    record.status,
    (_, next) => next,
  );

  const handlePublish = () => {
    const prev = optimisticStatus;
    startTransition(async () => {
      addOptimisticStatus("PUBLISHED");
      try { await publishAction(); }
      catch { addOptimisticStatus(prev); }
    });
  };

  // Button visibility and badges read from optimisticStatus
  const canPublish = optimisticStatus === "DRAFT";
  // ...
}
```

### Pattern 4: Optimistic close for create dialogs

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  onClose();                              // close dialog immediately
  try {
    await createAction(formData);
    router.refresh();                     // refresh page data in background
  } catch (err) {
    setError(err.message);                // show error (only if dialog re-opens)
  }
};
```

**Rules:**
- `useOptimistic` for list/board data where items have stable IDs
- Local `useState` for single-value fields (status, priority, toggles)
- The `startTransition` wrapper lets React show the optimistic state before the async work completes
- Always capture the previous value before the optimistic update — revert to it on error
- `revalidatePath` in the server action + `router.refresh()` in the client handles eventual consistency with the server
- No external caching libraries needed — React 19 builtins do everything

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
- Use `.env.railway.example` as the default Railway variable template for non-local settings.
- Wire `DATABASE_URL` and `REDIS_URL` into the web and worker services via Railway shared/service variables or Railway service references, then replace the remaining placeholders in the Railway dashboard.
- Environment variables live in Railway dashboard — never in committed files.
- Staging: auto-deploys on push to `main`. Production: deploy from a version tag.
- For a remote production seed, run `SEED_PROFILE=minimal pnpm db:seed` inside Railway or from a machine using Railway's externally reachable database credentials.

### Railway Config as Code

Each service needs its **Config as Code Path** set in the Railway dashboard:

| Service | Root Directory | Config as Code Path |
|---------|---------------|---------------------|
| web | `/` | `apps/web/railway.json` |
| worker | `/` | `apps/worker/railway.json` |

Root Directory **must** be `/` so Railpack can resolve pnpm workspace dependencies. Without the Config as Code Path, Railway ignores the `railway.json` files and falls back to defaults.

The canonical production Railway start command is `HOSTNAME=0.0.0.0 pnpm --dir apps/web start:deploy`, which delegates to `node .next/standalone/apps/web/server.js` and forces the standalone Next server to bind on Railway's network interface. The `pnpm start` / `next start` script is for local testing only — it requires full `node_modules` and skips the standalone build.

## Key Files

| File | Purpose |
|---|---|
| `.env.railway.example` | Default Railway variable template — copy values into Railway shared/service variables |
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
