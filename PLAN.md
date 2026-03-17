# Quark Admin UI, Observability & Alerting — Consolidated Review

**Date:** February 25, 2026  
**Type:** Final architectural review (harsh pass)  
**Supersedes:** `ADMIN_UI_PROPOSAL.md`, `ADMIN_UI_SUMMARY.md`, `ADMIN_UI_VISUAL_GUIDE.md`, `OBSERVABILITY_PLAN.md`, `OBSERVABILITY_SUMMARY.md`

---

## Part 0: Honest Assessment of Previous Documents

Five documents were produced across two sessions. Before combining them into a single plan, here's what was wrong with each:

### What the previous documents got right
- Correctly identified that Quark's Prometheus metrics infrastructure (`metrics.js`) is already production-grade and that "Phase 1" is largely done
- Self-scaling via Prisma DMMF introspection is the right core idea for an admin package
- Alerting via adapter pattern matching `error-reporter.js` is architecturally consistent
- Quark Observe as a separate repository is the correct boundary
- The Observe vision (Fastify hub, multi-project aggregation, SDK) is directionally viable

### What was wrong

**1. The UI package was completely ignored.**

Every document mentions "Tailwind + Shadcn" as the component system. But `packages/ui` exists today as a scaffolded local package — it contains **one component** (`Button`), uses raw `React.createElement`, and exports nothing else. The docs describe it as the place for "Reusable UI components." The architecture doc says "UI is inherently custom" and therefore stays local.

None of the five documents addressed this contradiction: how can `@techstream/quark-admin` (a published registry package) render a sidebar, data tables, stat cards, forms, and modals when the only UI building blocks in the ecosystem are a single `Button` component in a local package the admin package cannot import?

**2. Component code examples were fiction.**

The `ADMIN_UI_PROPOSAL.md` showed imports like:
```javascript
import { Table, TableBody, ... } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
```
These components do not exist anywhere in the Quark codebase. The documents described a Shadcn component library that has never been set up. There is no `@/components/ui/table`. There is no `Card`, `Dialog`, `Input`, `Select`, or `Badge`.

**3. `@prisma/internals` dependency was handwaved.**

The plan said "use `getDMMF()` from `@prisma/internals` at build time." This package is Prisma's internal tooling — it is large (~50MB installed), not designed for end-user consumption, and its API has broken between Prisma versions without notice. Depending on it for a published package is risky. None of the documents mentioned this risk or proposed alternatives.

**4. Effort estimates need context.**

"2–3 weeks for admin MVP" is reasonable — the current repo itself took a similar amount of time to reach its current state. The estimate is valid provided the UI template is expanded first (Phase 0). The key constraint is sequencing, not the timeline.

**5. Quark Observe was planned in too much detail too early.**

The vision — Prisma schemas, Fastify server, SDK packages, multi-project aggregation — is viable and directionally correct. The issue is timing: there are currently zero Quark projects in production. Detailed architectural decisions should be deferred until Phases 1–3 are live and generating real telemetry data. The direction is right; the depth of planning was premature.

---

## Part 1: The UI Package Problem

### Current State

| File | Contents |
|------|----------|
| `packages/ui/src/button.js` | Single `Button` component using `React.createElement`. Two variants (primary, secondary). Hardcoded Tailwind classes. |
| `packages/ui/src/index.js` | `export * from "./button.js"` |
| `packages/ui/package.json` | `@techstream/quark-ui`, `private: true`, React 19 as devDep |
| Tests | 4 trivial assertions (is a function, accepts props, supports variants) |
| Coverage | 100% — because there are 4 lines of code |
| Template | CLI scaffolds an identical copy to `@yourapp/ui` in new projects |

### What the architecture says about `packages/ui`

From `docs/ARCHITECTURE.md`:
> "UI is inherently custom — Design systems differ per brand. Component APIs match product needs. Shared components evolve with features."

From `docs/MAINTAINABILITY.md`:
> "packages/ui — Reusable UI components. Should NOT contain business logic or API calls."

The barrel export even has planned future exports commented out:
```javascript
// Future exports
// export { Input } from "./input.js";
// export { Card } from "./card.js";
```

### The answer: Yes, Admin must use the UI package — and the UI template must be expanded first.

`quark-admin` will be scaffolded locally via the CLI — exactly like `ui`, `config`, and `jobs`. This means `packages/admin/` is a workspace package that can depend on `@yourapp/ui` directly. The "published package can't use a local package" constraint disappears.

However, the problem remains: the current UI template has one component. Admin needs ~12. The solution is to expand the UI template when admin is selected.

#### Option A: Expand the UI template when `admin` is selected (recommended)

When the CLI scaffolds a project with the admin feature, it generates an expanded `packages/ui/` template that includes the full set of primitives admin needs: Table, Card, Input, Select, Badge, Dialog, etc.

**Pros:**
- Consistent with the existing distribution model — everything is scaffolded, owned by the project
- Admin shares components with the rest of the app; a consistent design system emerges naturally
- No publishing overhead; no semver concerns for UI primitives
- Projects can modify any component without fighting an external package version
- Aligns with the architecture doc: "UI is inherently custom"

**Cons:**
- No automatic updates to UI components after scaffolding (known tradeoff of the model)
- If a UI bug is fixed in the template, existing projects don't get it automatically

#### Option B: Admin template ships its own isolated components

Admin scaffolds its UI components separately in `packages/admin/src/components/`, independent of `packages/ui/`.

**Pros:**
- Admin is fully self-contained

**Cons:**
- Button, Input, etc. exist in both `packages/ui/` and `packages/admin/` — two sources of truth
- Visual inconsistency between admin and the rest of the app unless deliberately synced
- More code to maintain per project

#### Recommendation: **Option A — Expand `packages/ui/`**

This is architecturally consistent: the same pattern Quark uses for all other scaffolded packages. Admin selecting UI as a required dependency is handled by the CLI — selecting `admin` automatically includes `ui` (the prompt locks it).

The CLI template for `ui` is auto-generated from the monorepo source via `sync-templates.js`. No manual mirroring is required. When a new component is added to `packages/ui/`, running `pnpm sync-templates` updates the CLI template.

The one known tradeoff of this model: if a bug is found in a scaffolded UI component, existing projects don't receive the fix automatically. This is intentional and acceptable — projects own the code and can apply the fix manually from the updated template. It should be documented explicitly in `packages/ui/README.md`.

---

## Part 2: Revised Architecture

### Distribution Model

Quark's distribution philosophy is intentional and unchanged:

| Type | How Distributed | Rationale |
|------|----------------|----------|
| `@techstream/quark-core` | npm (published) | Framework infrastructure — stable API, projects should not modify internals |
| `@techstream/quark-create-app` | npm (published) | CLI scaffolder |
| `@yourapp/ui` | CLI template | UI primitives — owned by project, modified freely |
| `@yourapp/config` | CLI template | App configuration — owned by project |
| `@yourapp/jobs` | CLI template (optional) | Background job definitions — owned by project |
| `@yourapp/admin` | CLI template (optional, requires ui) | Admin UI — owned by project |

This matches the model used by `create-t3-app`, `create-remix-app`, and similar tools. The tradeoff — no automatic updates for scaffolded packages — is intentional. Projects that need a bug fix applied to a scaffolded package do so manually from the updated template.

### Package Map (what changes)

| Package | State | Change |
|---------|-------|--------|
| `@techstream/quark-core` | Published ✅ | Add `alerting.js` + alert adapters + queue metrics |
| `@techstream/quark-create-app` | Published ✅ | Add `admin` feature prompt (requires `ui`); add alerting scaffold |
| `packages/ui` template | Scaffolded (1 component) | **Expand to ~12 primitives** when `admin` feature selected |
| `packages/admin` template | Does not exist | **New scaffolded package.** Self-scaling admin UI. |

### Workspace Dependency Graph (scaffolded project)

```
Scaffolded project
├── @techstream/quark-core     (npm — auth, queues, metrics, email, errors, alerting)
├── @yourapp/db                (local — Prisma schema + client)
├── @yourapp/config            (local — environment, validation)
├── @yourapp/ui                (local — UI primitives, ~12 components if admin selected)
├── @yourapp/jobs              (local, optional — background job definitions)
└── @yourapp/admin             (local, optional — self-scaling admin UI)
    └── depends on @yourapp/ui (workspace:*)
```

### What changes for scaffolded project architecture

| Before | After |
|--------|-------|
| `packages/ui/` scaffolded with 1 Button component | `packages/ui/` scaffolded with ~12 components when admin is selected |
| No admin package | `packages/admin/` scaffolded with self-scaling CRUD UI |
| Admin requires manual route setup | Admin routes scaffolded automatically (2 files in `apps/web/`) |
| `jobs` and `ui` are the two optional CLI features | `jobs`, `ui`, and `admin` are the three optional features; `admin` auto-requires `ui` |

---

## Part 3: UI Package — What to Build

### Scope: Atomic primitives only

The UI package ships **only** headless-styled atomic components. No domain components, no layouts, no business logic.

```
packages/ui/
├── package.json              # @yourapp/ui (private, workspace package)
├── src/
│   ├── index.js              # Barrel export
│   ├── button.js             # ✅ Exists (needs JSX + variants update)
│   ├── input.js              # Text input
│   ├── select.js             # Dropdown select
│   ├── checkbox.js           # Checkbox toggle
│   ├── badge.js              # Status badge (colored label)
│   ├── card.js               # Card container
│   ├── table.js              # Table, TableHead, TableBody, TableRow, TableCell
│   ├── dialog.js             # Modal dialog (uses native <dialog>)
│   ├── toast.js              # Toast notification
│   ├── label.js              # Form label
│   ├── textarea.js           # Multi-line text input
│   ├── skeleton.js           # Loading skeleton
│   └── ... (tests co-located)
└── __tests__/
```

### Component Design Principles

1. **Server Component compatible** — No `"use client"` unless truly interactive (Dialog, Toast). Most components are pure rendering.
2. **Tailwind-only styling** — Class strings, no CSS-in-JS, no runtime overhead.
3. **Composable** — Components accept `className` prop for overrides. Use `clsx` or template literals for merging.
4. **Accessible** — ARIA attributes, keyboard handling, focus management on interactive elements.
5. **No Radix dependency (for now)** — Start with native HTML elements. Add Radix if/when complexity demands it (e.g., complex Combobox, Popover). Keep the dependency footprint minimal.

### Example: Table component

```javascript
// packages/ui/src/table.js
import React from 'react';

export function Table({ className = '', children, ...props }) {
  return (
    <div className="w-full overflow-auto">
      <table className={`w-full caption-bottom text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className = '', ...props }) {
  return <thead className={`border-b ${className}`} {...props} />;
}

export function TableBody({ className = '', ...props }) {
  return <tbody className={`[&_tr:last-child]:border-0 ${className}`} {...props} />;
}

export function TableRow({ className = '', ...props }) {
  return <tr className={`border-b transition-colors hover:bg-gray-50 ${className}`} {...props} />;
}

export function TableHead({ className = '', ...props }) {
  return <th className={`h-10 px-2 text-left align-middle font-medium text-gray-500 ${className}`} {...props} />;
}

export function TableCell({ className = '', ...props }) {
  return <td className={`p-2 align-middle ${className}`} {...props} />;
}
```

No dependency. No runtime. Pure HTML + Tailwind. Works as Server Component. Fully overridable via `className`.

### Effort: ~1 week

~12 components, co-located tests, barrel export, and a `README.md` documenting the component API. All work happens in `packages/ui/src/`. Running `pnpm --filter @techstream/quark-create-app sync-templates` snapshots the result into `packages/cli/templates/ui/` — the template that gets dropped into user projects during scaffolding. The playground page lives in `apps/web/src/app/playground/` (monorepo reference) and is also stored as a standalone `packages/cli/templates/playground/` entry, copied conditionally into user projects only when `ui` is selected.

---

## Part 4: Admin Package — Revised Plan

### Self-Scaling via Prisma (Revised Approach)

The previous plan used `@prisma/internals` and `getDMMF()`. This is fragile. Revised approach:

**Use `prisma._dmmf` from the project's existing PrismaClient at runtime.** Every instantiated PrismaClient exposes its DMMF (Data Model Meta Format) on the instance. No extra package needed.

```javascript
// packages/admin/src/lib/introspect.js

/**
 * Extract model metadata from an existing PrismaClient instance.
 * No @prisma/internals needed — the instantiated client already has the DMMF.
 */
export function getModelsFromClient(prisma) {
  // Prisma 7 exposes _dmmf on the client instance
  // This contains the full data model including all fields, types, and relations
  const dmmf = prisma._baseDmmf || prisma._dmmf;

  if (!dmmf?.datamodel?.models) {
    throw new Error('Could not read Prisma DMMF. Ensure PrismaClient is instantiated.');
  }

  return dmmf.datamodel.models
    .filter(model => !isHiddenModel(model))
    .map(model => ({
      name: model.name,
      dbName: model.dbName || model.name,
      fields: model.fields
        .filter(f => !isHiddenField(f))
        .map(field => ({
          name: field.name,
          type: field.type,
          kind: field.kind,         // 'scalar' | 'object' | 'enum'
          isList: field.isList,
          isRequired: field.isRequired,
          isId: field.isId,
          isReadOnly: field.isReadOnly,
          hasDefaultValue: field.hasDefaultValue,
          relationName: field.relationName || null,
          documentation: field.documentation || null,
        })),
    }));
}

// Hidden models (internal infrastructure that shouldn't appear)
const HIDDEN_MODELS = new Set(['Account', 'Session', 'VerificationToken']);

function isHiddenModel(model) {
  if (HIDDEN_MODELS.has(model.name)) return true;
  return model.documentation?.includes('@admin.hidden');
}

function isHiddenField(field) {
  if (field.name === 'password') return true;  // Never show password fields
  return field.documentation?.includes('@admin.hidden');
}
```

**This eliminates the `@prisma/internals` dependency entirely.** The admin package takes the project's `prisma` client as a parameter and reads the schema from it. Zero new dependencies for introspection.

### Smart Field Rendering

When admin discovers a model, it maps Prisma field types to UI components from `@techstream/quark-ui`:

| Prisma Type | Field Kind | Admin Renders |
|-------------|-----------|--------------|
| `String` | scalar | `<Input type="text" />` |
| `String` (is `@id`) | scalar | Read-only text (non-editable) |
| `Int` / `Float` | scalar | `<Input type="number" />` |
| `Boolean` | scalar | `<Checkbox />` |
| `DateTime` | scalar | `<Input type="datetime-local" />` |
| `Json` | scalar | `<Textarea />` with JSON formatting |
| `Enum` | enum | `<Select>` with enum values as options |
| FK relation | object | `<Select>` populated from related model |
| `password` | scalar | **Hidden** — never rendered |
| `createdAt` / `updatedAt` | scalar | Read-only display in table; hidden in forms |

### Admin Package Structure (revised)

```
packages/admin/
├── package.json                 # @yourapp/admin (private, workspace package)
│                                # dependencies: @yourapp/ui (workspace:*), @yourapp/db (workspace:*)
├── src/
│   ├── index.js                 # Public API
│   ├── admin-page.js            # Main routing component (dashboard | model list | model edit)
│   ├── admin-layout.js          # Sidebar + header + RBAC gate
│   ├── lib/
│   │   ├── introspect.js        # getModelsFromClient(prisma) — DMMF reading
│   │   ├── query.js             # Generic findMany/count/update/create/delete via prisma[model]
│   │   ├── field-map.js         # Prisma type → UI component mapping
│   │   └── format.js            # formatBytes, formatDate, pluralize, etc.
│   └── components/
│       ├── model-table.js       # Auto-generated data table for any model
│       ├── model-form.js        # Auto-generated create/edit form for any model
│       ├── field-renderer.js    # Renders correct input per field type
│       ├── dashboard.js         # Overview: model counts + health + recent activity
│       ├── metrics-panel.js     # Fetch + display /api/metrics data
│       ├── health-panel.js      # Fetch + display /api/health data
│       ├── alert-panel.js       # Show active alert state (if alerting configured)
│       ├── sidebar.js           # Navigation generated from discovered models
│       ├── pagination.js        # Prev/next controls
│       └── stat-card.js         # Metric display card
└── __tests__/
    ├── introspect.test.js
    ├── query.test.js
    └── field-map.test.js
```

### What the CLI scaffolds

When `admin` is selected, the CLI generates:

```
packages/admin/           ← full workspace package (copied from templates/admin/)
packages/ui/              ← ~12 components (copied from templates/ui/, auto-generated from packages/ui/ source)
apps/web/src/app/admin/   ← two route files
```

The two route files are the only integration points the developer sees:

```javascript
// apps/web/src/app/admin/layout.js
import { AdminLayout } from '@yourapp/admin';
import { auth } from '@/lib/auth';

export default async function Layout({ children }) {
  const session = await auth();
  return <AdminLayout session={session}>{children}</AdminLayout>;
}
```

```javascript
// apps/web/src/app/admin/[[...segments]]/page.js
import { AdminPage } from '@yourapp/admin';
import { auth } from '@/lib/auth';
import { prisma } from '@yourapp/db';

export default async function Page({ params }) {
  const session = await auth();
  return <AdminPage segments={params.segments} session={session} prisma={prisma} />;
}
```

Add `model Team { ... }` to `schema.prisma`, run `pnpm db:generate`, refresh `/admin` — the Teams page appears automatically with a table, search, pagination, and edit forms. No setup.

Since `packages/admin/` is locally owned, developers can modify any admin component without workarounds.

---

## Part 5: Alerting Framework — No Changes From Previous Plan

The alerting design in `OBSERVABILITY_PLAN.md` was correct. Summary:

- **`packages/core/src/alerting.js`** — `AlertEngine` class with `addRule()`, `use(adapter)`, `evaluate()`, `start(intervalMs)`.
- **Adapters** — `email.js` (reuses existing `email.js`), `webhook.js` (native `fetch`), `slack.js` (wraps webhook), `pagerduty.js` (native `fetch`). Zero new runtime dependencies.
- **Rules** — Plain JS condition functions, not a DSL. `condition: (snap) => snap.get('app_errors_total') > 50`.
- **State** — In-memory per process. No Prisma model. History deferred to Observe.
- **Scaffolded config** — `packages/config/src/alerts.js` provides example rules; developers own the file.

No changes needed. This design is clean.

---

## Part 6: Queue Metrics — No Changes From Previous Plan

Three additions to `packages/core`:

1. Pre-register `jobQueueDepth` (gauge), `jobsProcessedTotal` (counter), `jobDuration` (histogram) in `metrics.js`
2. Auto-instrument `createWorker()` handler wrapper in `queue/index.js`
3. Export `getRegisteredQueues()` from `queue/index.js` for health check consumption

Three days of work. Additive. No breaking changes.

---

## Part 7: Quark Observe — Revised Vision (Umami Model)

### What was planned too early

The previous plan included a Fastify server architecture, Prisma schema, SDK packages, and SaaS pricing tiers for Observe. This is a viable long-term vision. The issue is timing: there are currently zero Quark projects in production. The detailed design decisions (storage schema, pull vs push, alert history retention) will be better informed by real usage patterns once Phases 0–3 are live. Don't design the schema for data that doesn't exist yet.

### Revised positioning: The Umami Model

Quark Observe follows the Umami playbook: open-source first, self-hostable, clean UI, affordable. It does not aim to replace Sentry or compete with Datadog. It aims to be **good enough for 90% of teams**, in one place, with a clean UI and an honest price.

**Key principles:**
- Same codebase for self-hosted and SaaS
- Self-hosted deployable with a single `docker compose up`
- SaaS adds: multi-project aggregation, longer retention, multi-region uptime checks, team management, zero-ops
- Modules ship incrementally: error tracking first, then metrics, then analytics
- Priced for indie devs and small teams ($19/mo flat)

### What should exist today

A single-page decision document (not an implementation plan) that records:

| Decision | Answer |
|----------|--------|
| Separate repo? | Yes — `Bobnoddle/quark-observe` |
| Uses Quark itself? | Yes — dogfood the framework |
| Integration model? | Push (SDK sends events to Observe ingest API) + Pull (optional scrape `/api/metrics` and `/api/health`) |
| Projects opt-in how? | `QUARK_OBSERVE_URL` env var (self-hosted) or `QUARK_OBSERVE_KEY` (SaaS) |
| Self-hostable? | Yes — same codebase as SaaS — single `docker compose up` |
| When to build? | Phase 5 — after AI package ships and at least 2 Quark projects are deployed |

**Detailed Observe planning should resume after Phases 0–3 are live and real projects are generating metrics.** Module rollout: error tracking + app metrics (Month 3), uptime monitoring + alerting (Month 4), web analytics + AI metrics (Month 5).

---

## Part 8: Revised Phase Plan

| Phase | What | Touches | Effort | New Deps | Prerequisite |
|-------|------|---------|--------|----------|--------------|
| **0** | **Expand UI package to ~12 primitives + home page + playground** | `packages/ui/`, `apps/web/`, `packages/cli/` | **1 week** | None (native HTML + Tailwind) | None |
| **1** | Queue metrics + auto-instrumentation + queue health | `quark-core` | 3 days | None | None |
| **2** | Scaffold `packages/admin/` + CLI `admin` feature prompt | `packages/admin/`, `packages/cli/` | **2–3 weeks** | None (uses `prisma._dmmf`) | Phase 0 |
| **3** | Alerting engine + adapters; scaffolded config | `quark-core` + `quark-create-app` | 2 weeks | None | Phase 1 |
| **4** | **`@techstream/quark-ai` — AI provider abstraction (published npm)** | New npm package | **2 weeks** | `ai` SDK (optional peer) | None |
| **5** | **Quark Observe (separate repo, Umami model)** | `quark-observe` (new repo) | **6–8 weeks** (phased modules) | Separate repo deps | Phases 1–3 live |
| **6** | **Quark Cloud — managed infra + compute** | `quark-cloud` (new repo/service) | **8–12 weeks** | Partner APIs (Neon, Upstash, R2) | Phase 5 MVP live |

### Package distribution alignment

| Package | Type | Optional? | Requires | Notes |
|---|---|---|---|---|
| `@techstream/quark-core` | Published (npm) | No | — | Core framework runtime |
| `@techstream/quark-create-app` | Published (npm) | No | — | CLI scaffolder |
| `@techstream/quark-ai` | **Published (npm)** | **Yes** | `quark-core` | AI provider abstraction — thin, no lock-in |
| `@yourapp/ui` | Scaffolded (CLI) | **Yes** | — | ~12 Tailwind primitives when selected |
| `@yourapp/admin` | Scaffolded (CLI) | **Yes** | **`ui`** | Self-scaling CRUD admin UI |
| `@yourapp/config` | Scaffolded (CLI) | No | — | Environment config |
| `@yourapp/db` | Scaffolded (CLI) | No | — | Prisma schema + client |
| `@yourapp/jobs` | Scaffolded (CLI) | Yes | — | BullMQ job definitions |
| `@yourapp/worker` | Scaffolded (CLI) | No* | — | BullMQ worker process (*always scaffolded, can be removed) |

### Critical path

```
Phase 0 (UI primitives) ─┬─→ Phase 2 (Admin UI)
                          │                       ╲
Phase 1 (Queue metrics)  ─┴─→ Phase 3 (Alerting)  ─→ Phase 5 (Observe) → Phase 6 (Cloud)
                                                    ╱
Phase 4 (AI package) ─────────────────────────────╱
```

Phases 0 and 1 can run in parallel. Phase 4 (AI package) can run in parallel with Phases 0–3. Phase 5 depends on Phases 1–3 (metrics and alerting must be live). Phase 6 depends on Phase 5 MVP.

**Total estimated effort for Phases 0–4: ~8–9 weeks (pre-monetization)**
**Total estimated effort for Phases 5–6: ~14–20 weeks (monetization products)**

---

## Part 9: Things the Previous Documents Got Wrong (Corrections)

| Claim in previous docs | Reality | Correction |
|------------------------|---------|------------|
| "Tailwind CSS + Shadcn as the base component library in `packages/ui`" | `packages/ui` has one Button. Zero Shadcn components exist. | Phase 0 expands the UI package to ~12 real components. |
| "`@techstream/quark-admin` published to npm" | Admin should be scaffolded via CLI like all other non-core packages. | `packages/admin/` scaffolded template; `@yourapp/admin` workspace dep. |
| "`@prisma/internals` for DMMF; build-time only" | `@prisma/internals` is ~50MB, unstable API, breaks between versions. | Use `prisma._dmmf` from the instantiated client. Zero new deps. |
| "Phase 1 Template Baseline: 1–2 weeks" | Metrics infrastructure already exists. Only 3 additions needed. | 3 days. |
| Quark Observe with detailed Fastify schema, SDK, SaaS pricing | Viable vision but no production usage data to validate design decisions yet. | Lock in vision; defer detailed planning until Phases 1–3 are live. |
| "Recharts as optional peer dep for charts" | Adds a significant dep to admin for one page. | Use `<table>` or `<svg>` for simple metric display in MVP. |
| Admin imports `from '@/components/ui/table'` (Shadcn path) | This Shadcn path convention doesn't exist in Quark. | Admin imports `from '@yourapp/ui'` (workspace dep). |
| "Sync all files to `packages/cli/templates/ui/src/` manually" | CLI templates are **generated** from monorepo source via `sync-templates.js`. There is no manual mirroring step. | Build components in `packages/ui/`. Run `pnpm sync-templates`. CI drift check enforces parity. |
| Home page and playground can import from `@yourapp/ui` freely | `apps/web/` syncs to base-project template used by **all** scaffolded projects, including those without `ui`. | Home page uses no UI package imports. Playground is conditionally scaffolded only when `ui` is selected (excluded from base-project sync; added as a separate CLI template). |
| "`next.config.js` `transpilePackages` is handled by the CLI" | The existing `replaceDepsScope` strips optional deps from `package.json` but never touches `next.config.js`. `@techstream/quark-ui` and `@techstream/quark-jobs` remain in `transpilePackages` even when those features are not selected. | Add `patchNextConfig()` to the CLI scaffold step to remove unselected feature entries from `transpilePackages`. |

### Documentation gap (not covered in any previous document)

No existing doc describes the UI component API or usage patterns:
- `docs/ARCHITECTURE.md` — no mention of `packages/ui`
- `docs/QUARK_USAGE.md` — mentions `@yourscope/ui` as optional, gives no component list or import examples
- `.github/skills/quark-context/SKILL.md` — lists "Tailwind CSS + Shadcn" which is aspirational, not actual; no listing of available components

**Phase 0 deliverable must include:** a `packages/ui/README.md` that lists every exported component with its props and an import example. The quark-context SKILL.md "Tech Stack" row for UI must be updated from "Tailwind CSS + Shadcn" to "Tailwind CSS + custom primitives (`packages/ui`)" and the component list added to the coding standards section.

---

## Part 10: Phase 0 — Implementation Detail

### How CLI templates actually work (critical context)

There are two distinct tiers, and confusing them breaks the plan.

**Tier 1 — Quark monorepo development cycle:**
`packages/ui/src/` is the source of truth. `packages/cli/scripts/sync-templates.js` copies it to `packages/cli/templates/ui/`, applying naming transforms. This runs before every CLI release — either manually by the Quark maintainer or automatically via the pre-commit hook. `packages/cli/templates/ui/` is a committed snapshot of the current component set, included in the published `quark-create-app` package.

**Tier 2 — User project scaffolding:**
When a user runs `quark-create-app` and selects `ui`, the CLI copies `packages/cli/templates/ui/` into their project as `packages/ui/`. From that moment the copy is **entirely theirs**. There is no connection back to Quark — no auto-sync, no version drift checks. They can modify, delete, or replace any component freely. This is the intentional Quark philosophy: scaffolded packages are owned by the project.

**Implication for Phase 0:** Build all components in `packages/ui/src/`. Run `pnpm --filter @techstream/quark-create-app sync-templates` to update `packages/cli/templates/ui/`. The CI drift check enforces that the template snapshot stays current with the monorepo source before any CLI release. User projects are unaffected.

### Three implementation constraints the original plan missed

#### 1. `transpilePackages` gap in `next.config.js`

The monorepo `apps/web/next.config.js` hardcodes `@techstream/quark-ui` (and `@techstream/quark-jobs`) in `transpilePackages` unconditionally. When the CLI scaffolds a project without `ui`, `replaceDepsScope` correctly strips the dep from `package.json` — but `next.config.js` is never patched. The resulting project references a package that doesn't exist.

**Fix required in Phase 0:** Add a post-scaffold step to the CLI (alongside the existing `replaceDepsScope` function) that rewrites `transpilePackages` in `next.config.js` to only include entries matching the selected features. This is a CLI change, not a template change.

```javascript
// packages/cli/src/index.js — new helper (alongside replaceDepsScope)
async function patchNextConfig(webDir, selectedFeatures) {
  const configPath = path.join(webDir, 'next.config.js');
  if (!(await fs.pathExists(configPath))) return;
  const optionalPackages = { ui: '@myquark/ui', jobs: '@myquark/jobs' };
  let content = await fs.readFile(configPath, 'utf-8');
  for (const [feature, pkg] of Object.entries(optionalPackages)) {
    if (!selectedFeatures.includes(feature)) {
      // Remove the entry from the transpilePackages array
      content = content.replace(new RegExp(`\\s*"${pkg.replace('/', '\\/')}",?\\n?`, 'g'), '\n');
    }
  }
  await fs.writeFile(configPath, content);
}
```

#### 2. Home page must not import from `@yourapp/ui`

`apps/web/src/app/page.js` syncs directly into the base-project template — it will appear in **every** scaffolded project, including those that chose not to include `ui`. The home page cannot import from `@yourapp/ui`.

**Resolution:** The home page is designed with no UI package imports. It uses plain JSX + Tailwind classes directly. A comment in the file directs developers who have `ui` selected to refactor using their components.

```javascript
// apps/web/src/app/page.js
// No @yourapp/ui imports — this page is part of the base template.
// If you scaffolded the ui package, feel free to replace these with your components.
```

#### 3. The playground page is `ui`-conditional

`apps/web/src/app/playground/page.js` imports from `@yourapp/ui` and is nonsensical in a project without the package. It cannot live in the base-project template.

**Resolution:** The playground is excluded from the base-project sync via `EXCLUDE_PATTERNS` in `sync-templates.js`. The CLI scaffolds it conditionally — copied from a standalone template entry (`packages/cli/templates/playground/`) only when `ui` is selected.

This requires two additions:
- `packages/cli/templates/playground/` directory containing the playground page
- A new entry in the CLI's feature-conditional copy step (alongside where `ui` and `jobs` templates are copied into `packages/`)

### Updated impact table

| | Current | After Phase 0 |
|---|---|---|
| `packages/ui/src/` | 1 Button via `React.createElement` | ~12 components via JSX |
| `packages/ui/src/index.js` | exports `Button` only | barrel for all ~12 |
| CLI feature list | `["ui", "jobs"]` | `["ui", "jobs"]` (unchanged; `admin` is Phase 2) |
| `next.config.js` scaffolding | hardcodes all optional packages | patched at scaffold time based on selected features |
| `apps/web/src/app/page.js` | 3-line placeholder | clean home page, no UI package imports |
| `apps/web/src/app/playground/` | does not exist | new; excluded from base template, scaffolded conditionally with `ui` |
| `packages/cli/templates/playground/` | does not exist | new conditional template |
| CI template drift check | passes | must pass after sync-templates run |

### For existing projects

Existing projects are unaffected. If a developer wants to add `ui` to an existing project, the CLI `update` command should offer to scaffold the package — same pattern used for `jobs`.

---

## Part 11: Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `prisma._dmmf` is not public API; may change | Medium | Pin `@prisma/client` version range in admin's package.json; add integration test that reads DMMF; review on each Prisma major |
| Admin dynamic routing (`[[...segments]]`) conflicts with project routes | Low | Admin namespaced under `/admin/*`; catch-all is scoped to that prefix |
| Alert engine in-memory state lost on process restart | Low (by design) | Alerts re-evaluate next cycle. Persistent history is Observe's job. |
| UI package is a one-time scaffold — no auto-updates | Low (known tradeoff) | Document the tradeoff clearly. Bug fixes in the template are applied manually by developers. |
| Charting in admin adds a heavy dependency | Low | MVP uses `<table>` and simple `<svg>`. Add a charting library in a later iteration. |
| `transpilePackages` lists unselected packages in scaffolded `next.config.js` | **Medium (existing gap)** | `patchNextConfig()` in CLI scaffold step removes unselected entries. Must be covered by a CLI scaffolding integration test. |
| Playground page in `apps/web/` syncing to base-project template | Low | Playground added to `EXCLUDE_PATTERNS` in `sync-templates.js`. Stored as a standalone CLI template copied conditionally. Verified by sync-templates dry-run in CI. |

---

## Part 12: Open Questions

| # | Question | Recommendation |
|---|----------|---------------|
| 1 | Should the UI template use Radix UI primitives? | **No for v1.** Native HTML elements only. Add Radix if/when specific components need it (Combobox, Popover). Zero new deps. |
| 2 | Should UI components use CSS or Tailwind classes? | **Tailwind classes only.** No separate CSS file. Projects already have Tailwind configured. |
| 3 | Should `packages/admin/` support `"use client"` interactive features? | **Minimally.** Dashboard, list pages, and audit logs are Server Components. Only Dialog (edit form) and Toast need `"use client"`. |
| 4 | What Prisma versions does admin support? | **Prisma 7 only.** Pin `@prisma/client` version range in `packages/admin/package.json`. DMMF shape is stable within a major version. |
| 5 | Should alert adapters be in `quark-core` or a separate package? | **In `quark-core`.** Matches `error-reporter.js` pattern. Avoids package proliferation. Zero new deps. |
| 6 | Should existing projects get admin via `quark update`? | **Yes.** The CLI `update` command should offer to scaffold the admin package into existing projects. |
| 7 | Should the repo go public before or after Phase 0–3 ships? | **After.** Clean up the codebase as planned. Making it public doesn't change the distribution model; the main consideration on going public is OSS governance for `quark-core` (contribution guide, issue templates, semver discipline). |

---

## Overview Summary

### What is being built

Four things, in order:

1. **An expanded UI package** (`packages/ui/`) — ~12 Tailwind-styled primitives with JSX, tests, and a `README.md` documenting the component API. Source-of-truth in the monorepo; snapshotted into `packages/cli/templates/ui/` via `sync-templates.js` for distribution. Once scaffolded into a user project, the copy is theirs — no connection back to Quark. The playground page in `apps/web/` is scaffolded conditionally only when `ui` is selected.

2. **A self-scaling admin package** (`packages/admin/` via CLI) — reads Prisma models at runtime, generates CRUD pages automatically. Scaffolded locally; fully modifiable. Requires `ui`.

3. **An alerting framework** (inside `@techstream/quark-core`) — adapter-based, mirrors error-reporter pattern, zero new dependencies. Email, webhook, Slack, PagerDuty adapters built-in.

4. **Quark Observe** (separate repo, Umami model) — open-source observability platform, self-hostable with `docker compose up`. SaaS version adds multi-project aggregation, longer retention, and zero-ops. Modules ship incrementally: error tracking → metrics → uptime → analytics → AI metrics.

5. **`@techstream/quark-ai`** (published npm package) — thin AI provider abstraction. Unified API for OpenAI, Anthropic, Google, Ollama. Streaming, token counting, structured outputs, embeddings, prompt versioning. Free and optional.

6. **Quark Cloud** (managed infrastructure + compute) — one-click deploy of web, worker, Postgres, Redis, and storage. Convenience product, not a necessity — the CLI shows Railway, Docker, and self-hosted as equally prominent options.

### Summary table

| Phase | Name | Effort | New Deps | Deliverable |
|-------|------|--------|----------|-------------|
| 0 | UI Package Expansion | 1 week | None | `packages/ui/` (~12 components + README); conditional playground template; `patchNextConfig()` in CLI; quark-context SKILL.md updated |
| 1 | Queue Metrics | 3 days | None | `@techstream/quark-core` (minor bump) |
| 2 | Admin Package | 2–3 weeks | None | `packages/admin/` in monorepo; CLI `admin` feature; `pnpm sync-templates` generates template |
| 3 | Alerting | 2 weeks | None | `@techstream/quark-core` (minor bump) |
| 4 | AI Package | 2 weeks | `ai` SDK (optional peer) | `@techstream/quark-ai` published to npm |
| 5 | Quark Observe | 6–8 weeks | Separate repo | `quark-observe` (new repo, Umami model, self-hostable + SaaS) |
| 6 | Quark Cloud | 8–12 weeks | Partner APIs | `quark-cloud` (managed infra + compute platform) |

### Key decisions

| Decision | Answer |
|----------|--------|
| Should admin/observe use the UI package? | **Yes. `packages/ui/` is expanded in Phase 0. Admin depends on it as a workspace package.** |
| Is admin a published npm package? | **No.** Scaffolded via CLI, same as `ui`, `config`, `jobs`. Locally owned. |
| Is `@techstream/quark-ai` published to npm? | **Yes.** Published, optional. Teams install it when they want AI features. Free. |
| How does admin discover models? | `prisma._dmmf` at runtime. No `@prisma/internals`. Zero new deps. |
| Where does alerting live? | Inside `quark-core`. Adapter pattern. Zero new deps. |
| When is Quark Observe planned in detail? | Phase 5 — after AI package ships and Phases 1–3 are live. Umami model: self-hostable, open-source first. |
| When is Quark Cloud planned in detail? | Phase 6 — after Observe MVP is live. Convenience product, not necessity. |
| What was wrong with the previous proposals? | Proposed publishing admin as an npm package (should be scaffolded). Assumed Observe needed full detail before any production usage. Ignored the empty UI template. |
| How do CLI templates stay in sync with UI changes? | **Automated snapshot.** `sync-templates.js` generates `packages/cli/templates/ui/` from `packages/ui/` source before each CLI release. Once a user scaffolds, their copy is disconnected — they own it entirely. No auto-updates, by design. |
| Can the home page use `@yourapp/ui`? | **No.** `apps/web/page.js` syncs to the base-project template used by all projects, including those without `ui`. Plain JSX + Tailwind only. |
| How does the playground get scaffolded? | **Conditionally.** Excluded from base-project sync. Stored in `packages/cli/templates/playground/`. CLI copies it only when `ui` is selected. |
| What about `transpilePackages` for unselected features? | **CLI patch step required.** A new `patchNextConfig()` helper removes unselected feature entries from `transpilePackages` in `next.config.js` at scaffold time. |
| Is the UI component API documented? | **Not yet — this is a Phase 0 deliverable.** `packages/ui/README.md` documents all exported components with props and import examples. The quark-context SKILL.md is updated to reflect actual components. |

---

*This document supersedes all previous admin/observability proposals (now deleted).*
