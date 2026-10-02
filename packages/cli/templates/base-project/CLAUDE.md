# __QUARK_PROJECT_NAME__ - AI Context

> Scaffolded with [Quark](https://github.com/usequark/quark) on __QUARK_SCAFFOLD_DATE__.

## Quick Start

```bash
docker compose up -d     # PostgreSQL, Redis, Mailpit
pnpm install
pnpm db:generate         # Generate Prisma client
pnpm db:migrate          # Apply database migrations
pnpm db:seed             # Seed development data
pnpm dev                 # Start web + worker
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
└── .env.example              # Template - copy to .env to get started
```

## Non-Negotiable Rules

- **ESM only** — `import`/`export`. Never `require()` or `module.exports`.
- **No TypeScript** — `.js` and `.jsx` files only.
- **Zod required** — all Server Actions and API routes must validate with Zod.
- **No `throw new Error()`** — use `AppError` / `ValidationError` from `@techstream/quark-core/errors`.
- **No `console.log`** — use `createLogger(name)` from `@techstream/quark-core`.
- **DB models** — every Prisma model must include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.

## Package Imports

```javascript
// Published (from npm) - @techstream/ prefix:
import { AppError, ValidationError } from "@techstream/quark-core/errors";
import { createLogger } from "@techstream/quark-core";
import { getCurrentSession } from "@techstream/quark-core";

// Workspace packages - ALWAYS use @__QUARK_SCOPE__/:
import { prisma } from "@__QUARK_SCOPE__/db";
import { loadConfig } from "@__QUARK_SCOPE__/config";
import { Button, Card } from "@__QUARK_SCOPE__/ui";
import { JOB_NAMES } from "@__QUARK_SCOPE__/jobs";
```

## UI Components

All components from `@__QUARK_SCOPE__/ui`. Tailwind-only, Server Component-safe.

- `Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox` — form primitives
- `Badge`, `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`
- `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`
- `Skeleton`, `ErrorBanner`, `Footer`, `Navbar`/`MobileNavbar`
- `Dialog` *(client)*, `Toast`/`useToast` *(client)*, `ThemeProvider`/`useTheme` *(client)*

Import from `@__QUARK_SCOPE__/ui` — never `@/components/ui/*`. Every component accepts `className`.

## Server Actions

```javascript
"use server";
import { z } from "zod";
import { ValidationError, AppError } from "@techstream/quark-core/errors";
import { getCurrentSession } from "@techstream/quark-core";
import { createLogger } from "@techstream/quark-core";
import { prisma } from "@__QUARK_SCOPE__/db";

const log = createLogger("action:example");
const schema = z.object({ title: z.string().min(1).max(255) });

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
import { NextResponse } from "next/server";
import { AppError } from "@techstream/quark-core/errors";

export async function GET(request) {
  try {
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

## Database

- Schema: `packages/db/prisma/schema.prisma`
- Query helpers: `packages/db/src/queries.js` — do not call `prisma.*` directly in pages/actions.
- After schema changes: `pnpm db:generate` then `pnpm db:migrate`.

## Auth

```javascript
import { getCurrentSession } from "@techstream/quark-core";
const session = await getCurrentSession();
if (!session) redirect("/login");            // Server Component
if (!session) throw new AppError("Unauthorized", 401);  // Server Action
```

## Background Jobs

```javascript
// Dispatch:
import { createQueue, addJob } from "@techstream/quark-core";
import { JOB_NAMES } from "@__QUARK_SCOPE__/jobs";
await addJob(createQueue("default"), JOB_NAMES.SEND_WELCOME_EMAIL, { userId });

// Handle in apps/worker/src/handlers/<job-name>.js:
export async function handleSendEmail({ data }) { /* ... */ }
```

## Testing

```bash
docker compose up -d  # Required: Postgres + Redis
pnpm test             # Run all tests
```

Tests are co-located: `feature.test.js` next to `feature.js`. Uses Node.js built-in `node --test`.

## Deployment

Railway with two services: **web** (`apps/web`) and **worker** (`apps/worker`). Migrations run automatically on deploy.

## Key Files

| File | Purpose |
|---|---|
| `packages/db/prisma/schema.prisma` | Database schema |
| `packages/db/src/queries.js` | Query helpers |
| `packages/config/src/validate-env.js` | Env var validation |
| `apps/web/src/app/` | Next.js pages and API routes |
| `apps/web/src/lib/auth.js` | NextAuth configuration |
| `apps/worker/src/handlers/` | Job handler functions |
| `apps/web/public/sw.js` | Service worker (if PWA enabled) |
| `apps/web/src/app/manifest.json` | PWA manifest (if enabled) |

---

*Update this file when you make structural changes: new packages, deployment targets, or major conventions.*
