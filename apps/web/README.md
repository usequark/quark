# Quark — Web App

The Next.js 16 reference application for the Quark monorepo. App Router, Server Actions, Tailwind v4, and full auth/admin out of the box.

## Quick Start

From the monorepo root:

```bash
pnpm install
docker compose up -d        # PostgreSQL + Redis + Mailpit
pnpm db:generate            # Generate Prisma client
pnpm db:migrate             # Run migrations
pnpm db:seed                # Seed demo users
pnpm dev                    # Start all apps (web on :3005, worker)
```

Then open [http://localhost:3005](http://localhost:3005).

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp apps/web/.env.example apps/web/.env
```

The most important values to set:

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | Full URL the app runs on — must match exactly, no trailing slash |
| `NEXTAUTH_SECRET` | Long random secret — `node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('hex'))"` |
| `POSTGRES_*` | Match your `docker-compose.yml` defaults |
| `REDIS_HOST` / `REDIS_PORT` | Match your `docker-compose.yml` defaults |

## Seed Credentials

After running `pnpm db:seed`:

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `Password1` | admin |
| `viewer@example.com` | `Password1` | viewer |

## Key Routes

| Route | Description |
|---|---|
| `/` | Public home page |
| `/auth/signin` | Sign in (credentials + optional OAuth) |
| `/auth/register` | Create a new account |
| `/admin` | Admin dashboard — requires `role: "admin"` |
| `/admin/[model]` | Auto-generated CRUD for every Prisma model |

## Structure

```
src/
├── app/
│   ├── admin/          # Auto-CRUD admin panel
│   ├── auth/           # Sign in, register, error, forgot password
│   ├── api/auth/       # NextAuth route handler
│   ├── globals.css     # Design token layer (edit here to rebrand)
│   └── layout.js       # Root layout + ThemeProvider
└── lib/
    └── auth.js         # NextAuth config (createAuthConfig from quark-core)
```

## Authentication

Auth is provided by NextAuth v5 with credentials + optional GitHub/Google OAuth.

To enable OAuth, set the provider env vars (see `.env.example`) — the providers are already wired in `src/lib/auth.js`.

To protect a page, call `auth()` at the top of a Server Component:

```js
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  // session.user.id, session.user.email, session.user.role available here
}
```

To restrict to admins only:

```js
if (session.user.role !== "admin") redirect("/");
```

## User Auth for Customer-Facing Features

The register page creates accounts for any user. To add customer-facing protected routes (booking, account, checkout, etc.):

1. Add your route, e.g. `src/app/dashboard/page.js`
2. Call `auth()` and redirect unauthenticated visitors to `/auth/signin`
3. Use `session.user.id` to scope all queries to the current user
4. No role check needed — admin routes separately guard via `role !== "admin"`

## Rebranding

All design tokens live in `src/app/globals.css` inside the `@theme inline` block. Change `--color-primary` and `--radius-default` — nothing else needs touching. See `docs/ARCHITECTURE.md` for the full rebranding checklist.
