# Quark Design Notes

> **Status: Accepted, partially superseded** (August 2026)
> Sections 1, 2.1, 2.4, and decisions D1, D2, D5, D6 describe the shipped architecture. Sections 2.2, 2.3, 2.5, D3, D8, D9, and all of section 4 describe an **admin shell and skill-only verticals that were later removed entirely**. They are kept here as the record of why the current shape exists. Do not treat them as a roadmap.
> See `AGENTS.md` and `docs/ARCHITECTURE.md` for what actually ships.

This document captures the design direction for reducing Quark's overhead while keeping it a low-effort, low-opinionation scaffold.

---

## 1. The Problem

Quark's original goal was a scaffold with **low effort** (one command to a working app) and **low opinionation** (the user chooses their stack). Over time, overhead accumulated that works against both goals:

- **Admin UI bloat.** A full themed admin panel (23 files, 8 themes, heavy `@usequark/quark-ui` imports) ships as an opt-in feature. It is a no-brainer for client work but friction for other projects.
- **Decision friction.** The interactive CLI asks a 6-option multiselect ("which packages?"). That is a *mechanics* question, not a *product* question, and it forces a decision the user may not want to make.
- **Design-language leak.** The admin's themed UI + the `design-system` skill actively push AI agents to reproduce Quark's admin aesthetic in user-facing pages. The admin is a contamination carrier.
- **Package sprawl.** Vertical packages (`bookings`, `crm`, `cms`, `ai`) are opt-in but over-built — full implementations where most users need a generic starting point.

## 2. Core Direction

The design converges on **API-first + AI-assisted scaffolding**:

> **Quark = the backend contract + agent context. The AI = the frontend.**

The user describes the product; the AI (or the user) scopes it. Quark provides the pre-wired infrastructure and the context that lets an agent build on it reliably.

### 2.1 Two-view CLI

The CLI exposes two views over the same engine:

- **Human View (default, no params).** Interactive, product-shaped questions ("Describe your app in a sentence or two") with an **advanced** expander for full package/custom configuration. Progressive disclosure: simple by default.
- **AI View (params).** A documented, deterministic flag surface (`--packages`, `--preset`, `--prompt`, `--no-prompts`) that an agent calls reliably. Same params → same scaffold, every time.

### 2.2 Admin shell: proposed, then removed

> **Not shipped.** The design below reframed the admin from a data-management tool to a **business operations surface**: decision-relevant values plus tools to add/update/remove the project and deployment, shipping patterns rather than pages. In the end the whole admin package was deleted rather than reframed. `packages/admin` does not exist and `quark add admin` is not a valid feature.
>
> What survived: the `add-dashboard` skill, which teaches the AI to build a metrics overview page, and the `add-endpoint` skill's role guards. `AGENTS.md` no longer promotes a design-system skill, which removed the design-language leak this section was written to prevent.

For reference, the original proposal was:

- A neutral shell (sidebar + main).
- Dashboard / metric-card patterns (decision values).
- Action-form patterns (add/update/remove).
- Auto-CRUD as a **fallback** for models with no custom view yet.

### 2.3 Verticals = domain starters, not packages

Vertical features become **skill-only**: no scaffolded code, the skill carries the domain knowledge and the AI builds the system on demand.

> **Partially shipped.** The vertical packages were deleted, and the per-vertical skills (`bookings`, `crm`, `cms`, `ai`) were never written. What ships is a smaller set: `payment`, `ecommerce` (with catalog, cart, checkout sub-skills), and `i18n`, alongside the workflow skills `add-model`, `add-endpoint`, and `add-dashboard`. `skills/quark-skills/SKILL.md` indexes exactly these. Any new vertical still follows the pattern below, but each one has to be authored.

The pattern the skills are expected to encode:

```
# what a bookings skill would teach the AI to build:
<harness>/skills/bookings/SKILL.md         # domain context + Quark patterns
packages/db/prisma/schema.prisma           # Booking model (AI-generated)
apps/web/src/app/api/bookings/route.js     # CRUD: create/read/update/delete
apps/web/src/app/api/bookings/[id]/route.js
```

The original full vertical packages were archived to `docs/archive/reference/`, so the old domain logic is preserved as reference source.

### 2.4 MAIN.md + Embedded Skills

- **`MAIN.md`** — a single "read this first" GPS at repo root that routes the agent: project brief → `CLAUDE.md` (rules) → `docs/` (guides) → `openapi.yaml` (contract) → `<harness>/skills/` (feature specs). Token-efficient bootstrap: *"Read MAIN.md, then build X."*
- **Embedded Skills (`<harness>/skills/`)** — markdown feature specs placed for auto-loading by the chosen AI harness. Each skill: what it builds, patterns to follow, workflow, end-result shape, and a pointer to the archived reference implementation. This is the vibe-coder differentiator and the home for the verticals' domain knowledge.

### 2.5 Package scope reduction

Reduce the scaffolded package surface from 12 to ~8, and convert the 4 verticals from packages to skills.

## 3. Decisions

| ID | Decision | Status | Rationale |
|----|----------|--------|-----------|
| D1 | API-first: Quark = backend contract + agent context | ✅ Accepted | Matches the vibe-coder market; AI is the UI layer |
| D2 | Two-view CLI (Human + AI) | ✅ Accepted | Human gets simple questions; AI gets a deterministic contract |
| D3 | Admin = neutral operations shell (patterns + CRUD fallback) | ❌ Removed | The admin package was deleted outright; the design leak it addressed is gone with it |
| D4 | Verticals = skill-only (AI builds on demand) | ✅ Accepted | Lean, honest 80/20; user/AI builds the 20% |
| D5 | Skills carry the domain knowledge | ✅ Accepted | Replaces the value that used to live in full packages |
| D6 | MAIN.md single entry point | ✅ Accepted | Token-efficient agent bootstrap (create-vibe-app pattern) |
| D7 | Quark logo embedded in scaffolded page | ✅ Present | Brand anchor; already ~80% present |
| D8 | Demote/hide originals (archive), don't delete | ✅ Applied | Archive lives at `docs/archive/reference/` |
| D9 | Decouple admin from themed UI + design-system skill | ✅ Moot | The admin was removed; `AGENTS.md` no longer promotes a design-system skill |

## 4. Target Architecture

### 4.1 Package scope

| Package | Status | Notes |
|---------|--------|-------|
| `core` | published | Runtime library |
| `create-app` (CLI) | published | Launcher, also bins `quark`, `create-quark-app`, `quark-update` |
| `config` | scaffolded, always | Env config. In `REQUIRED_PACKAGES` |
| `db` | scaffolded, always | Prisma. In `REQUIRED_PACKAGES` |
| `ui` | scaffolded, always | Tailwind primitives. In `REQUIRED_PACKAGES` (was opt-in) |
| `web` (base) | scaffolded, always | Next.js base + logo |
| `worker` | scaffolded, opt-in | Pulled in by `quark add jobs` |
| `mobile` | scaffolded, opt-in | Expo app, via `quark add mobile` |
| `pwa` | scaffolded, opt-in | PWA manifest and service worker, via `quark add pwa` |
| `admin` | **removed** | No package, no `quark add admin` |
| `bookings` / `crm` / `cms` / `ai` | **removed** | No package, no skill. See 2.3 |

`REQUIRED_PACKAGES = ["db", "config", "ui"]` in `packages/cli/src/index.js` is the source of truth.

### 4.2 CLI map

**Shipped:**
```
quark <name>                            # default action, no `create` subcommand
  └─ interactive multiselect: [ui] [jobs] [pwa] [mobile]
  └─ any provided option auto-skips prompts
add <feature>                           # ui | jobs | pwa | mobile
skill <feature>                         # print an embedded skill
update [--check] [--scaffold-check] [--fail-on-drift] [--force]
deploy railway | deploy inspect | deploy status
flags: --packages --prompt --signup --harness --skip-install --skip-docker
```

**Proposed and never built:** a `--preset <bundle>` flag (client-work / internal-tool / product / minimal) and a `create` subcommand. Neither exists. `--no-prompts` shipped but is now deprecated, since providing any option already skips prompts.

### 4.3 Admin structure (proposed, then removed)

Never shipped. Kept for the record; there is no `admin-routes/` directory to look for.

```
admin-routes/
  layout.js            # neutral shell: sidebar (sections) + main
  page.js              # dashboard: metric cards (decision values)
  [model]/page.js      # auto-CRUD FALLBACK (until a custom view exists)
  _actions/crud.js     # server actions (the real logic)
  _patterns/
    Dashboard.js       # metric-card pattern
    ActionForm.js      # add/update/remove form pattern
    DeployPanel.js     # project/deployment controls pattern
```

## 5. Non-goals & Open Questions

- **No scaffold-time LLM dependency.** The CLI stays fast and offline; the agent scopes during development, not at scaffold time.
- **Skill quality is the risk.** The skill-only verticals ship no code; the skills must carry the domain knowledge or functionality is lost.
- **Resolved, dropped:** `--preset` bundles were never implemented. Use `--packages` for deterministic selection.
- **Open:** whether `worker` stays opt-in or moves to a starter.
- **Resolved:** the archived originals live in `docs/archive/reference/`.
