# Quark Feature Plan

> Status: Draft for review
> Date: August 2026
> Companion: [DESIGN_NOTES.md](./DESIGN_NOTES.md) — the design rationale this plan executes.

## Execution Model

Each feature is **isolated**: it is owned by a single agent, touches only its own files, and never edits another feature's files. Features integrate through **contracts** (documented interfaces), not by cross-editing.

For every feature, an agent must respect:

- **Scope** — the exact files/dirs it owns. Do not touch anything outside it.
- **Contract** — the interface it produces (for consumers) or consumes (from producers).
- **Dependencies** — what it needs from other features, consumed by contract only.
- **Verification** — how to prove it works in isolation.
- **Isolation boundary** — what it must explicitly NOT touch.

## Feature Index

| ID | Feature | Depends on | Parallel-safe |
|----|---------|-----------|---------------|
| F1 | MAIN.md + entry-point context | F2 (structure) | after F2 |
| F2 | Prompt Library (`recipes/`) | — | ✅ now |
| F3 | Minified admin operations shell | — | ✅ now |
| F4 | Minified verticals (domain starters) | F2 (recipe format) | after F2 |
| F5 | Two-view CLI | F6 (feature list) | after F6 |
| F6 | Package scope reduction | F4 (starter set) | after F4 |
| F7 | Quark logo in scaffold | — | ✅ now |
| F8 | Design-language decoupling | F3 (admin de-themed) | after F3 |

**Recommended order:** F2 → F4 → F6 → F5 (the dependency chain), with F3, F7 running in parallel from the start, and F8 after F3, F1 after F2.

---

## F1 — MAIN.md + entry-point context

**Goal:** A single "read this first" GPS file that routes agents to the right context.

**Scope:**
- `MAIN.md` (new, repo root of scaffolded project — i.e. `packages/cli/templates/base-project/MAIN.md`)
- `packages/cli/templates/base-project/CLAUDE.md` (add a pointer to MAIN.md)

**Contract (produces):**
- `MAIN.md` at scaffold root containing: project brief placeholder, links to `CLAUDE.md`, `docs/`, `openapi.yaml`, `recipes/`.
- `CLAUDE.md` references `MAIN.md` as the entry point.

**Dependencies:** F2 (references `recipes/` path — consume the agreed path, do not create it).

**Verification:** Scaffold a project; confirm `MAIN.md` exists and `CLAUDE.md` links to it; confirm the brief placeholder is populated from the CLI description.

**Isolation boundary:** Do NOT create `recipes/` (F2 owns it). Do NOT edit the CLI (F5 owns it).

---

## F2 — Prompt Library (`recipes/`)

**Goal:** A library of markdown feature recipes that agents execute against Quark conventions.

**Name:** `recipes/` (locked). Established in the AI-boilerplate space; distinct from `docs/` (reference) and `templates/` (code). Rejected: `prompts/` (too raw), `playbooks/` (ops-flavored), `blueprints/` (structure-flavored).

**Location (two contexts):**
- **Source of truth (monorepo):** `packages/cli/templates/base-project/recipes/` — scaffolded into projects.
- **Scaffolded project:** `<project>/recipes/` at repo root — agents find it immediately; `MAIN.md` links to it.

**Scope:**
- `packages/cli/templates/base-project/recipes/` (new directory)
- `packages/cli/templates/base-project/recipes/README.md` (how to use + how to write a recipe)
- `packages/cli/templates/base-project/recipes/_TEMPLATE.md` (recipe format: frontmatter + body)
- `packages/cli/templates/base-project/recipes/add-model.md` (core: add a Prisma model + query helpers)
- `packages/cli/templates/base-project/recipes/add-endpoint.md` (core: add a CRUD endpoint)
- `packages/cli/templates/base-project/recipes/add-dashboard.md` (core: add a decision dashboard to admin)

**What ships (do NOT ship the whole library):**
- **Core set ships by default:** `README.md`, `_TEMPLATE.md`, `add-model.md`, `add-endpoint.md`, `add-dashboard.md`.
- **Vertical recipes ship with their feature** (F4 owns those): `add bookings` → `recipes/bookings.md`, `--features crm` → `recipes/crm.md`, etc.
- **Full library lives in the monorepo**, pulled on demand via `add <feature>` / `recipe <feature>`.

**Structure (flat, for agent discoverability):**
```
recipes/
  README.md          # how to use + how to write a recipe
  _TEMPLATE.md       # the recipe format (frontmatter + body)
  add-model.md       # core: add a Prisma model + query helpers
  add-endpoint.md    # core: add a CRUD endpoint
  add-dashboard.md   # core: add a decision dashboard to admin
  bookings.md        # vertical — ships with bookings feature (F4)
  crm.md             # vertical (F4)
  cms.md             # vertical (F4)
  ai.md              # vertical (F4)
```

**Recipe format (frontmatter + markdown body):**
```markdown
---
name: Add a booking system
feature: bookings
files:
  - packages/db/prisma/booking.prisma
  - apps/web/src/app/api/bookings/route.js
  - apps/web/src/app/api/bookings/[id]/route.js
depends: [db, admin]
---
## What this builds
## Files created
## Patterns to follow
## Prompt to paste
```
The `files` list is the contract — it tells the agent exactly what to create and lets the CLI validate a recipe produced the right output.

**Contract (produces):**
- A documented recipe format: *what it builds, files created, patterns to follow, the prompt to paste* (frontmatter + body).
- The `recipes/` path that F1 and F4 reference.
- The core recipe set (`README.md`, `_TEMPLATE.md`, `add-model.md`, `add-endpoint.md`, `add-dashboard.md`).

**Dependencies:** none.

**Verification:** A recipe template renders correctly in a scaffolded project; `recipes/README.md` documents the format; the core set is present in a base scaffold.

**Isolation boundary:** Do NOT write domain-specific/vertical recipes (F4 owns those). Do NOT create `MAIN.md` (F1 owns it). Do NOT wire recipes into the CLI `add`/`recipe` commands (F5 owns that).

---

## F3 — Minified admin operations shell

**Goal:** Rebuild the admin from a themed CRUD UI into a neutral operations shell (patterns + CRUD fallback), removing all `@techstream/quark-ui` imports.

**Scope:**
- `packages/cli/templates/admin-routes/` (rebuild: layout, dashboard, `[model]` fallback, `_actions/crud.js`, `_patterns/`)
- `packages/cli/templates/admin/` (keep logic: `introspect.js`, `field-map.js`, `query.js`; remove theming references)

**Contract (produces):**
- Admin shell with neutral Tailwind (no quark-ui imports, no themes, no `QuarkLogo`/`ThemeToggle`).
- Auto-CRUD fallback for models without a custom view.
- `_patterns/Dashboard.js`, `_patterns/ActionForm.js`, `_patterns/DeployPanel.js`.
- A neutral Quark logo mark in `admin-routes/layout.js` (F3 owns the admin logo; F7 only handles the base page).

**Dependencies:** none (but F8 consumes the result).

**Verification:** Scaffold with `--features admin`; confirm admin renders with neutral styling, no quark-ui imports, CRUD fallback works for a model, and the logo mark renders in the shell.

**Isolation boundary:** Do NOT edit the `design-system` skill (F8 owns it). Do NOT edit the CLI feature list (F6 owns it). Do NOT touch the base page logo (F7 owns it).

---

## F4 — Minified verticals (domain starters)

**Goal:** Convert `bookings`, `crm`, `cms`, `ai` from full packages into minified domain starters (generic endpoint + model + recipe).

**Scope:**
- `packages/cli/templates/starters/` (new: `bookings/`, `crm/`, `cms/`, `ai/` — each a generic endpoint + Prisma model)
- `packages/cli/templates/base-project/recipes/<vertical>.md` (vertical recipes: `bookings.md`, `crm.md`, `cms.md`, `ai.md` — using F2's format)
- `reference/` (new, archive of the original full packages for recipe source + validation)

**Contract (produces):**
- A `starters/<vertical>/` with: a generic Prisma model and a CRUD endpoint.
- A vertical recipe `recipes/<vertical>.md` (F2 format) that documents the extension path.
- The set of starter names that F6 uses to define the CLI feature list.

**Dependencies:** F2 (recipe format + the `recipes/` path).

**Verification:** `add bookings` drops in the generic Booking model + CRUD endpoint + recipe; the recipe documents the extension path.

**Isolation boundary:** Do NOT edit the CLI (F5/F6 own it). Do NOT delete the originals — archive them to `reference/` (D8).

---

## F5 — Two-view CLI

**Goal:** Restructure the CLI into a Human View (product-shaped questions + advanced) and an AI View (deterministic params).

**Scope:**
- `packages/cli/src/index.js` (prompt flow + param handling + `recipe` command)
- `packages/cli/test-flags.js` (AI View param tests + `recipe` command tests)
- `packages/cli/README.md` (document both views + param contract + `recipe` command)

**Contract (produces):**
- Human View: "Describe your app" → brief → `MAIN.md`; advanced expander for full config.
- AI View: documented `--features`, `--preset`, `--prompt`, `--no-prompts`; deterministic output.
- `recipe <feature>` command: prints an AI prompt recipe for a feature.
- The param contract + `recipe` command documented in `packages/cli/README.md` (F5's own file — NOT `CLAUDE.md`/`MAIN.md`, which F1 owns).

**Dependencies:** F6 (the feature list it exposes).

**Verification:** `pnpm --filter @techstream/quark-create-app test` passes; `test-flags.js` covers the AI View params and the `recipe` command; a `--no-prompts` run is deterministic.

**Isolation boundary:** Do NOT edit templates (F1–F4 own them). Do NOT define the feature list (F6 owns it) — consume it. Do NOT edit `CLAUDE.md`/`MAIN.md` (F1 owns them).

---

## F6 — Package scope reduction

**Goal:** Remove the verticals from the CLI feature list and align the CLI with the new package scope.

**Scope:**
- `packages/cli/src/index.js` (`FEATURE_META`, feature choices, `add` command)
- `packages/cli/templates/base-project/README.md` (feature rows)
- `docs/` (scope references)

**Contract (produces):**
- The authoritative feature list (infrastructure + admin + starters) that F5 consumes.
- `FEATURE_META` updated: verticals removed as packages, exposed as starters.

**Dependencies:** F4 (the starter set).

**Verification:** `--features bookings` resolves to the starter, not a package; `add <starter>` works; `test-flags.js` passes.

**Isolation boundary:** Do NOT rebuild the admin (F3 owns it). Do NOT restructure the CLI views (F5 owns it) — only the feature list.

---

## F7 — Quark logo in scaffold

**Goal:** Ensure the Quark logo renders on the base page.

**Scope:**
- `packages/cli/templates/base-project/apps/web/src/app/page.js` (render logo)

**Contract (produces):** Logo present in the base page.

**Dependencies:** none.

**Verification:** Scaffold a project; confirm the logo renders on the base page.

**Isolation boundary:** Do NOT touch `admin-routes/layout.js` (F3 owns the admin shell + admin logo). Do NOT rebuild the admin shell (F3 owns it).

---

## F8 — Design-language decoupling

**Goal:** Neutralize the design-system skill so it no longer pushes Quark's admin aesthetic, and decouple admin from the themed UI.

**Scope:**
- `~/.config/opencode/skills/design-system/SKILL.md` (neutralize default-push for admin contexts)
- `packages/cli/templates/ui/package.json` (`designSystems` field — stop pointing admin at the themed skill)

**Contract (produces):** The design-system skill no longer instructs agents to apply Quark themes to admin work; admin no longer references the themed skill.

**Dependencies:** F3 (admin de-themed).

**Verification:** An agent working on an admin context does not load/apply Quark themes; admin package.json has no themed-skill reference.

**Isolation boundary:** Do NOT edit the admin shell (F3 owns it). Do NOT edit the CLI (F5/F6 own it).

---

## Dependency Graph

```
F2 (recipes) ──► F4 (starters) ──► F6 (scope) ──► F5 (CLI views)
F3 (admin shell) ──► F8 (design decouple)
F7 (logo)  [independent]
F1 (MAIN.md) ── depends on F2 path
```

## Parallelization

Run in parallel from the start: **F2, F3, F7**.
After F2: **F4, F1**.
After F3: **F8**.
After F4: **F6**.
After F6: **F5**.

## Integration & Verification

- Each feature verifies in isolation (see per-feature Verification).
- After all features land, run the full suite: `pnpm test`, `pnpm lint`, and a scaffold smoke test (`packages/cli/scripts/smoke-published.js`).
- Confirm the scaffolded project: has `MAIN.md` + `recipes/`, neutral admin shell, starters resolvable via `add`/`--features`, logo present, and no design-language leak.
