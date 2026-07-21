# Quark Architecture: Core-Only Registry Model

This document explains Quark's distribution architecture and the philosophy behind what gets published to the registry versus what gets scaffolded locally.

## The Problem We're Solving

Traditional web frameworks force a choice:
- **Framework-as-dependency**: Get updates but lose control (Next.js, Rails)
- **Boilerplate generators**: Full control but no updates (Create React App ejected, Rails new)

Quark takes a hybrid approach:

- **Core infrastructure comes from registry** - Centralized updates for auth, queues, validation
- **Business logic scaffolds locally** - Full control over database, jobs, UI
- **Update what you need** - Infrastructure gets updates, domain logic stays yours

## The Distribution Model

```
┌─────────────────────────────────────────────────────┐
│  Your Application (@yourapp/web, @yourapp/worker)   │
│  ├─ imports @techstream/quark-core (from registry)   │
│  └─ imports @yourapp/db, @yourapp/jobs (local)      │
├─────────────────────────────────────────────────────┤
│  @techstream/quark-core (npmjs.org)                  │
│  - createAuthConfig()                               │
│  - createQueue(), createWorker()                    │
│  - AppError, ValidationError                        │
│  - validateBody(), validateParams()                 │
│  ❌ No database client (no Prisma)                  │
│  ❌ No domain-specific logic                        │
├─────────────────────────────────────────────────────┤
│  @yourapp/db (Local - Always Scaffolded)            │
│  - schema.prisma (YOUR models)                      │
│  - PrismaClient instantiation                       │
│  - Query builders for your domain                   │
├─────────────────────────────────────────────────────┤
│  @techstream/quark-admin (npmjs.org, optional)      │
│  - Prisma DMMF introspection (runtime, no codegen)  │
│  - Auto-generated CRUD admin UI at /admin           │
│  - Field-type → input mapping, RBAC enforcement     │
├─────────────────────────────────────────────────────┤
│  @yourapp/ui (Local - Optional)                     │
│  - Full component library with dark mode support    │
│  - ThemeProvider, QuarkLogo, Badge, Button, Card,   │
│    Table, Dialog, Toast, Input, Select, Skeleton…   │
│  @yourapp/jobs (Local - Optional)                   │
│  @yourapp/config (Local - Optional)                 │
├─────────────────────────────────────────────────────┤
│  Infrastructure Packages (npm)                      │
│  - @prisma/client, BullMQ, next-auth, etc.          │
└─────────────────────────────────────────────────────┘
```

## What Lives in Core (Registry)

✅ **Infrastructure-Level Utilities**
- next-auth initialization helpers
- BullMQ queue factory
- Standardized error types
- Common utility functions (password hashing, etc.)
- File storage adapters (local filesystem built in, S3/Cloudflare R2 via optional SDK install)
- File validation with magic-byte detection
- Multipart form parsing with early limit enforcement
- Email service and templates

✅ **Provider-Agnostic Patterns**
- Error handling conventions
- Validation middleware
- Job queue abstractions
- Storage adapter abstraction (swap local ↔ S3 via env var)

✅ **Type Definitions**
- JSDoc for IDE support
- Common interfaces

❌ **Database Client** (moved to local `@yourapp/db`)
- Prisma schema is always customized per app
- Client instantiation requires app-specific connection config

❌ **Domain-Specific Logic**
- Your business models
- Your API endpoints
- Your UI components
- Your job handlers

❌ **Application Configuration**
- Environment-specific settings
- Deployment configurations
- Feature flags
- App-specific providers

## Why This Split?

### Core Infrastructure → Registry

**Auth, queues, validation rarely need customization:**
- Most apps use BullMQ the same way
- `createAuthConfig()` defaults work for 90% of cases
- Error types (`AppError`, `ValidationError`) are universal

**Benefits of registry distribution:**
- Bug fixes propagate instantly (`pnpm update`)
- Security patches reach all projects
- API improvements available immediately

### Database, Jobs, UI → Local Scaffolds

**Every app has unique domain models:**
- E-commerce needs `Product`, `Order`, `Cart`
- SaaS needs `Organization`, `Subscription`, `Invoice`
- Prisma schema is the most customized file in any project

**Jobs are domain-specific:**
- One app sends transactional emails
- Another processes video uploads
- Job handlers contain business logic, not infrastructure

**UI is inherently custom:**
- Design systems differ per brand
- Component APIs match product needs
- Shared components evolve with features

**Benefits of local scaffolding:**
- Full git history of domain changes
- No conflicts with central updates
- Freedom to refactor business logic

## Examples: Registry vs. Local

### Example 1: Authentication

**In Core (Registry):**
```javascript
// @techstream/quark-core - Provides defaults
import { createAuthConfig } from "@techstream/quark-core";

export const createAuthConfig = (options = {}) => {
  return {
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    callbacks: { /* default callbacks */ },
    ...options // Allow extensions
  };
};
```

**In Your App (Local):**
```javascript
// apps/web/lib/auth.js - Your customizations
import { createAuthConfig } from "@techstream/quark-core";
import GitHubProvider from "next-auth/providers/github";

export const authConfig = createAuthConfig({
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role; // Custom field
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      return session;
    },
  },
});
```

### Example 2: Database Client

**Before (Old Architecture - Circular Dependency):**
```javascript
// ❌ REMOVED: Core had database client
// @techstream/quark-core/src/db/index.js
export const createDbClient = () => {
  // Problem: Core depended on @techstream/quark-db
  // But db depended on core → circular!
};
```

**Now (Core-Only Registry - Clean):**
```javascript
// ✅ Core has NO database code
// @techstream/quark-core exports: auth, queues, validation, errors ONLY
```

**In Your Local DB Package:**
```javascript
// packages/db/src/client.js - YOU own this
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

// Build connection string from YOUR environment
const connectionString = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}...`;

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});
```

**Key Points:**
- Core has NO database client (no Prisma dependency)
- Each app creates client based on its own schema
- Your schema.prisma is completely custom

### Example 3: Job Definitions

**In Core (Registry):**
```javascript
// @techstream/quark-core/src/queue/index.js
export const createQueue = (name, options = {}) => {
  return new Queue(name, {
    connection: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    },
    defaultJobOptions: { attempts: 3, ... },
    ...options
  });
};
```

**In Your Local Jobs Package:**
```javascript
// packages/jobs/src/definitions.js - YOUR domain jobs
export const JOB_QUEUES = {
  EMAIL: "email-queue",
  FILES: "files-queue",
  VIDEO_PROCESSING: "video-queue", // Your custom queue
};

export const JOB_NAMES = {
  SEND_WELCOME_EMAIL: "send-welcome-email",
  SEND_RESET_PASSWORD_EMAIL: "send-reset-password-email",
  CLEANUP_ORPHANED_FILES: "cleanup-orphaned-files",
  TRANSCODE_VIDEO: "transcode-video", // Your custom job
};
```

**In Your Worker App:**

Handlers are extracted to separate files and registered in a handler map.
The worker dispatches jobs to the correct handler automatically.

```javascript
// apps/worker/src/handlers/video.js - YOUR custom handler
export async function handleTranscodeVideo(bullJob, logger) {
  logger.info(`Transcoding video ${bullJob.data.videoId}`);
  await transcodeVideo(bullJob.data);
  return { success: true };
}

// apps/worker/src/handlers/index.js - handler registry
import { JOB_NAMES } from "@yourapp/jobs";
import { handleSendWelcomeEmail, handleSendResetPasswordEmail } from "./email.js";
import { handleCleanupOrphanedFiles } from "./files.js";
import { handleTranscodeVideo } from "./video.js";

export const jobHandlers = {
  [JOB_NAMES.SEND_WELCOME_EMAIL]: handleSendWelcomeEmail,
  [JOB_NAMES.SEND_RESET_PASSWORD_EMAIL]: handleSendResetPasswordEmail,
  [JOB_NAMES.CLEANUP_ORPHANED_FILES]: handleCleanupOrphanedFiles,
  [JOB_NAMES.TRANSCODE_VIDEO]: handleTranscodeVideo, // Your custom job
};

// apps/worker/src/index.js - generic dispatch (no changes needed)
// The worker loops over JOB_QUEUES and dispatches to jobHandlers automatically.
```

**Key Points:**
- Core provides queue infrastructure (createQueue, createWorker)
- Your jobs package defines domain-specific queues and job types
- Worker contains your business logic in handler files
- Add a new job: create a handler function, register it, add the queue/name to definitions
- No need to rewrite queue setup

### Example 4: Database Client

**In Core:**
```javascript
// @techstream/quark-core/src/db/index.js
export const createDbClient = (options = {}) => {
  const globalForPrisma = globalThis;
  const prisma = globalForPrisma.prisma || new PrismaClient(options);
  
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }
  
  return prisma;
};
```

**In Your App:**
```javascript
// @techstream/quark-web/lib/db.js
import { createDbClient } from "@techstream/quark-core";

// Use with defaults - zero configuration!
const db = createDbClient();

// Or customize middleware
const db = createDbClient({
  middleware: [
    {
      $use: async (params, next) => {
        const before = Date.now();
        const result = await next(params);
        const after = Date.now();
        
        // Custom logging
        console.log(`${params.model}.${params.action} took ${after - before}ms`);
        
        return result;
      },
    },
  ],
});
```

**Key Points:**
- Core handles singleton pattern automatically
- Apps get working database with zero setup
- Can add middleware if needed

## Ejection Patterns

### Pattern 1: Selective Override

Use core for some things, replace others:

```javascript
// Keep core auth
import { createAuthConfig } from "@techstream/quark-core";

// Use custom queue setup
import Queue from "bullmq";

const authConfig = createAuthConfig({ providers: [...] });
const customQueue = new Queue("special", { custom: "options" });
```

### Pattern 2: Middleware Injection

Add behavior without changing core:

```javascript
import { createDbClient } from "@techstream/quark-core";

const db = createDbClient({
  middleware: [
    // Add logging
    loggingMiddleware,
    // Add audit trail
    auditMiddleware,
    // Add performance monitoring
    performanceMiddleware,
  ]
});
```

### Pattern 3: Wrapper Functions

Create application-specific wrappers around core:

```javascript
// lib/api-utils.js
import { requireAuth, UnauthorizedError } from "@techstream/quark-core";

export const withAuth = (handler) => {
  return async (req, res) => {
    const session = await getSession({ req });
    const userId = requireAuth(session);
    return handler(userId, req, res);
  };
};

// api/users/profile.js
import { withAuth } from "@/lib/api-utils";

export default withAuth(async (userId, req, res) => {
  const user = await db.user.findUnique({ where: { id: userId } });
  res.json(user);
});
```

### Pattern 4: Extension Classes

Extend core error types:

```javascript
// Extend core error with app context
class AppApiError extends AppError {
  constructor(message, statusCode, code, context = {}) {
    super(message, statusCode, code);
    this.context = context;
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      context: this.context,
    };
  }
}
```

## Migration Guide

### Starting with Core (Recommended)

```bash
# 1. Create new app
pnpm create quark my-app

# 2. Inherit core automatically
import { createDbClient } from "@techstream/quark-core";

# 3. Start using core utilities
const db = createDbClient(); // Works immediately
```

### Migrating Existing App

```javascript
// Before: everything in one file
// app/lib/auth.js
export const config = { providers: [...], ... };

// After: use core, eject what you need
// app/lib/auth.js
import { createAuthConfig } from "@techstream/quark-core";

export const config = createAuthConfig({
  providers: [...],
  callbacks: { /* your custom logic */ }
});
```

## When to Eject

**Eject when you need:**
- Custom authentication providers (GitHub, Google, SAML, etc.)
- Domain-specific errors
- Specialized queue configurations
- Database middleware for logging/auditing
- Application-specific utilities

**Don't eject if:**
- Core provides what you need
- You're trying to replace core entirely
- It's temporary test code

## Best Practices

### 1. Prefer Composition Over Replacement

```javascript
// ✅ Good: Extend core
import { createAuthConfig } from "@techstream/quark-core";

export const authConfig = createAuthConfig({
  providers: [CustomProvider()],
});

// ❌ Avoid: Rewriting from scratch
export const authConfig = {
  providers: [CustomProvider()],
  // ... missing all core defaults
};
```

### 2. Keep Core Portable

Core should work standalone:

```javascript
// ✅ Good: Core works in any app
import { createQueue } from "@techstream/quark-core";
const q = createQueue("jobs");

// ❌ Bad: Core depends on app setup
import { config } from "./config"; // App-specific
import { db } from "./db";         // App-specific
```

### 3. Document Your Ejections

```javascript
// lib/auth.js
/**
 * Authentication config for MyApp
 * 
 * Extends @techstream/quark-core with:
 * - GitHub OAuth provider
 * - Custom role field in JWT
 * - Email domain validation
 */
import { createAuthConfig } from "@techstream/quark-core";

export const authConfig = createAuthConfig({
  // Our customizations here...
});
```

### 4. Test Core Separately

```bash
# Core has its own tests
cd packages/core
pnpm test

# Apps test their ejections
cd apps/web
pnpm test
```

## Testing Strategy

Quark includes a comprehensive E2E testing approach to validate the entire project creation and startup workflow.

### CLI Testing Levels

**1. Unit Tests** - Template and scaffold validation
```bash
pnpm test
```
Fast validation (~5 seconds) that templates are valid and dependencies are correct.

**2. E2E Scaffolding Test** - Full project creation
```bash
pnpm test:e2e
```
Validates project scaffolding process (file creation, replacements, structure).

**3. Full Lifecycle Test** - Create → Install → Deploy → Startup (Optional)
```bash
pnpm test:e2e:full
```
Runs the complete workflow:
- Phase 1: Create project with `--no-prompts` flag
- Phase 2: Verify project structure
- Phase 3: Start Docker services (PostgreSQL, Redis, Mailpit)
- Phase 4: Run database migrations
- Phase 5: Seed database
- Phase 6: Start the application
- Phase 7: Verify application health

Takes ~40 seconds, requires Docker and available system resources.

### Running Tests Locally

```bash
# Quick validation
pnpm test

# Scaffolding only
pnpm test:e2e

# Full lifecycle (requires Docker)
pnpm test:e2e:full

# With build verification
QUARK_CLI_BUILD_TEST=1 pnpm test:build

# With generated image security scanning
QUARK_CLI_BUILD_TEST=1 QUARK_CLI_SCAN_IMAGES=1 pnpm test:build
```

Container runtime selection follows two rules:

- Pin the runtime version before changing the base image used by scaffolded deploy artifacts.
- Validate the full web and worker images; base-image scan results alone are not enough to change Quark's deploy contract.

### CI/CD Integration

For continuous integration pipelines:

```yaml
# Example: GitHub Actions
- name: Test CLI Creation
  run: |
    cd packages/cli
    pnpm test              # Always fast unit tests
    pnpm test:e2e          # Scaffolding validation
    # pnpm test:e2e:full   # Optional: full lifecycle (slow, needs Docker)
```

Quark keeps required PR-time image scanning focused on the source Dockerfiles in [ci.yml](../.github/workflows/ci.yml). Generated scaffold image scanning uses the same `test-build.js` harness and runs separately as a non-blocking workflow so the deploy contract stays validated without making every PR pay the full scaffold/build/scan cost.

### Non-Interactive Testing

All tests use the `--no-prompts` flag to run without user input:

```javascript
// test-e2e-full.js
await execute(`${cliPath} ${projectName} --no-prompts --features ui,jobs`, {
  cwd: E2E_TEST_DIR,
  timeout: 60000,
});
```

This enables:
- Automated CI/CD pipelines
- Reliable test results without user interaction
- Validation of default feature selection
- End-to-end verification of project templates

For manual testing with prompts, simply run without the flags:
```bash
npx @techstream/quark-create-app my-test-app
```

## The Future

As your app grows:

1. **Months 0-3**: Use core mostly unchanged
2. **Months 3-6**: Start ejecting for domain needs
3. **Months 6+**: Contribute improvements back to core

---

## Design System & Rebranding

Quark ships with a complete CSS token layer. Every colour, radius, and surface value is defined in one place - change it once and the entire UI updates.

### Token Source of Truth

All design tokens live in `apps/web/src/app/globals.css` inside the `@theme inline` block:

```css
@theme inline {
  /* Brand colour - swap this one value to change every button, link, and accent */
  --color-primary: oklch(0.6 0.15 250);
  --color-primary-hover: oklch(0.55 0.15 250);

  /* Surfaces */
  --color-bg: oklch(0.98 0 0);
  --color-surface: oklch(1 0 0);
  --color-surface-hover: oklch(0.96 0 0);

  /* Borders */
  --color-border: oklch(0.88 0 0);
  --color-border-hover: oklch(0.78 0 0);

  /* Text */
  --color-text: oklch(0.15 0 0);
  --color-text-muted: oklch(0.45 0 0);
  --color-text-faint: oklch(0.6 0 0);

  /* Semantic */
  --color-danger: oklch(0.6 0.18 25);
  --color-success: oklch(0.55 0.15 145);
  --color-warning: oklch(0.65 0.15 80);
  --color-info: oklch(0.6 0.12 230);

  /* Geometry - 0px for sharp, 0.25rem for rounded, 0.5rem for pill */
  --radius-default: 0px;
}
```

Dark mode overrides follow immediately under `[data-theme="dark"]`. To retheme a scaffolded project, edit **only** this block - no component files need touching.

### Geometry

`--radius-default` controls global border-radius for cards, inputs, buttons, and badges:

| Value | Effect |
|---|---|
| `0px` | Sharp, editorial (default) |
| `0.25rem` | Subtle rounding |
| `0.5rem` | Modern/rounded |
| `9999px` | Full pill |

Components reference this via Tailwind's `rounded-[--radius-default]` utility.

### Dark Mode

Quark uses **data-attribute dark mode**, not Tailwind's `dark:` class prefix:

```css
/* In globals.css */
@custom-variant dark (&:is([data-theme="dark"] *));
```

The `ThemeProvider` component (from `@techstream/quark-ui`) sets `data-theme="dark"` on the `<html>` element. This means:

- ✅ `dark:bg-surface` works in component files
- ✅ CSS variables automatically switch via `[data-theme="dark"]` overrides
- ❌ The system `prefers-color-scheme` media query is **not** used - theme is always explicit

### Template Sync

The scaffold templates in `packages/cli/templates/` are generated from monorepo source. After editing `globals.css` or any UI file, run:

```bash
pnpm --filter @techstream/quark-create-app sync-templates
```

CI checks for drift on every push and fails if templates are stale.

### Rebranding Checklist

To rebrand a scaffolded project:

1. Edit `--color-primary` (and `--color-primary-hover`) in `globals.css`
2. Edit `--radius-default` for the geometry feel
3. Update dark-mode overrides in `[data-theme="dark"]` if needed
4. Replace `QuarkLogo` with your own logo component
5. Update brand copy in the auth page brand panels (`auth/signin/page.js`, `auth/register/page.js`)

Core evolves based on real usage patterns!

---

## Admin UI (`@techstream/quark-admin`)

An optional published package that auto-generates a complete CRUD admin interface from your Prisma schema using DMMF introspection. No generated code - the admin UI reflects your live schema at runtime.

### What it does

- Reads all Prisma models and fields via `@prisma/client/runtime/library` DMMF
- Renders a collapsible sidebar of all model names
- Generates list/detail/create/edit views for every model automatically
- Maps Prisma field types to appropriate form inputs via `field-map.js`: strings → text, booleans → checkbox, enums → select, DateTime → datetime-local, numbers → number
- Filters fields by `isListVisible()`, `isEditable()` so internal IDs and timestamps display correctly but aren't editable in forms
- Enforces `role: "admin"` via the RBAC middleware - every admin route requires an authenticated admin session

### Routes

| Path | Purpose |
|---|---|
| `/admin` | Dashboard - lists all models with record counts |
| `/admin/[model]` | List view with all records |
| `/admin/[model]/new` | Create form |
| `/admin/[model]/[id]` | Edit/view form with delete |

### Key components

```
apps/web/src/app/admin/
├── layout.js              # Admin shell: sidebar + auth guard
├── page.js                # Dashboard
├── [model]/page.js        # List view → ModelTable
├── [model]/new/page.js    # Create form → ModelForm
├── [model]/[id]/page.js   # Edit/view → ModelForm
└── _components/
    ├── Sidebar.js          # Model navigation (from DMMF)
    ├── ModelTable.js       # Generic record list
    ├── ModelForm.js        # Generic create/edit form
    ├── FieldRenderer.js    # Field type → input mapping
    └── AdminThemeToggle.js # Compact theme toggle for admin sidebar
```

### Enabling the admin

Select it during scaffolding (`--features ui,jobs,admin`) or via the interactive CLI prompt. The templates (admin routes + `@techstream/quark-admin` dependency) are copied into your project at scaffold time.

---

## Theme System

Quark ships a **dark-mode-first** theme system built entirely on CSS custom properties and the HTML `data-theme` attribute - no class-flipping, no SSR flicker.

### How it works

1. **`data-theme` attribute** on `<html>` is the single source of truth - `"dark"` or `"light"`.
2. **Tailwind uses** `@custom-variant dark (&:is([data-theme="dark"] *))` so `dark:` utility classes react to the attribute, not a `dark` class.
3. **FOUC prevention**: a small blocking `<script>` in `layout.js` reads `localStorage.getItem("quark-theme")` and `prefers-color-scheme` synchronously before the first paint, writing `data-theme` before any React hydration.
4. **CSS custom properties**: all theme-sensitive colors (`--quark-page-bg`, `--quark-text-primary`, `--quark-border`, etc.) are defined dark-first in `:root` with light overrides in `@media (prefers-color-scheme: light)` and `[data-theme="light"]`.

### Theme API (from `@scope/ui`)

| Export | Type | Purpose |
|---|---|---|
| `ThemeProvider` | Client component | React context; provides `theme` and `setTheme` to a subtree |
| `useTheme()` | Hook | Returns `{ theme, setTheme }` from nearest `ThemeProvider` |
| `THEME_ATTR` | Constant | HTML attribute name (`"data-theme"`) |
| `THEME_STORAGE_KEY` | Constant | localStorage key (`"quark-theme"`) |
| `THEME_CHANGE_EVENT` | Constant | Custom event name for cross-component sync |

### Usage

```jsx
// Wrap your app (or a subtree) in ThemeProvider:
import { ThemeProvider } from "@scope/ui";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* FOUC prevention script goes here (auto-added by Quark) */}
      <body>
        <ThemeProvider defaultTheme="dark">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

// Read/set theme in a client component:
import { useTheme } from "@scope/ui";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
```

### Design principle

`ThemeProvider` is `"use client"` but all other components (`Card`, `Badge`, `Table`, `QuarkLogo`, etc.) are pure Server Components - theme adaptation happens via CSS variables, not JS. The `QuarkLogo` component specifically uses `var(--quark-logo-dark-arc)` to ensure the dark arc stroke remains visible against both light and dark backgrounds.

### Forcing a single theme (disabling the toggle)

Some sites should not offer theme switching - a marketing page with a specific aesthetic, or an app where dark mode simply doesn't fit. The correct method is to **set `data-theme` statically on `<html>`** and **remove the blocking script and toggle**. Because the attribute is present in the server-rendered HTML, there is no FOUC and no need for a script.

**To lock to light mode**, edit `apps/web/src/app/layout.js`:

```jsx
// Before (dynamic theme system):
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <FloatingThemeToggle />
        {children}
      </body>
    </html>
  );
}

// After (light-mode only):
export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light">
      <head />
      <body>
        {children}
      </body>
    </html>
  );
}
```

- Remove the `themeScript` constant and its `<script>` tag.
- Remove `<FloatingThemeToggle />` (and its import).
- Add `data-theme="light"` (or `"dark"`) directly to `<html>`.
- Remove `suppressHydrationWarning` - it is only needed when `data-theme` may differ between server and client.

**Why not just remove the toggle?** The blocking script restores the user's previously stored preference from `localStorage` on every visit. A user who previously switched to dark will still get dark even after the toggle is removed. The only reliable fix is to replace the script with a static attribute.

**Re-enableable flag pattern** - if you want to switch back later without hunting through JSX, add a single config constant:

```js
// apps/web/src/lib/theme-config.js
export const FORCED_THEME = "light"; // "light" | "dark" | null (auto/user-controlled)
```

Then drive `layout.js` from it:

```jsx
import { FORCED_THEME } from "../lib/theme-config.js";

const themeScript = /* existing blocking script string */;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      {...(FORCED_THEME ? { "data-theme": FORCED_THEME } : { suppressHydrationWarning: true })}
    >
      <head>
        {!FORCED_THEME && (
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        )}
      </head>
      <body>
        {!FORCED_THEME && <FloatingThemeToggle />}
        {children}
      </body>
    </html>
  );
}
```

Set `FORCED_THEME = null` to re-enable the full dynamic system with zero further changes.

## Resources

- [Core API Reference](./README.md)
- [Core Source Code](./src/)
- [Example Apps](../../apps/)
- [Contributing to Core](../../CONTRIBUTING.md)
