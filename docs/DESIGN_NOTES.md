# Quark Design Notes

> **Status: Accepted** (August 2026)
> This is the source of truth for Quark's architectural direction.

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

### 2.2 Admin = operations shell, not CRUD

The admin is reframed from a data-management tool to a **business operations surface**: decision-relevant values plus tools to add/update/remove/customize the project and deployment. It ships **patterns, not pages**:

- A neutral shell (sidebar + main).
- Dashboard / metric-card patterns (decision values).
- Action-form patterns (add/update/remove).
- Auto-CRUD as a **fallback** for models with no custom view yet.

It is deliberately neutral (plain Tailwind, no themed UI) so it never leaks a design language into user pages.

### 2.3 Verticals = domain starters, not packages

Vertical features (`bookings`, `crm`, `cms`, `ai`) become **skill-only verticals**: no scaffolded code - the embedded skill carries the domain knowledge and the AI builds the system on demand.

```
# what the bookings skill teaches the AI to build:
<harness>/skills/bookings/SKILL.md         # domain context + Quark patterns
packages/db/prisma/booking.prisma          # generic Booking model (AI-generated)
apps/web/src/app/api/bookings/route.js     # CRUD: create/read/update/delete
apps/web/src/app/api/bookings/[id]/route.js
```

The original full packages are **demoted/hidden** (archived to `reference/`), not deleted, so the domain logic is preserved as reference source and validation oracle.

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
| D3 | Admin = neutral operations shell (patterns + CRUD fallback) | ✅ Accepted | Serves decision-making, not data management; no design leak |
| D4 | Verticals = skill-only (AI builds on demand) | ✅ Accepted | Lean, honest 80/20; user/AI builds the 20% |
| D5 | Skills carry the domain knowledge | ✅ Accepted | Replaces the value that used to live in full packages |
| D6 | MAIN.md single entry point | ✅ Accepted | Token-efficient agent bootstrap (create-vibe-app pattern) |
| D7 | Quark logo embedded in scaffolded page | ✅ Present | Brand anchor; already ~80% present |
| D8 | Demote/hide originals (archive to `reference/`), don't delete | ✅ Accepted | Preserve tested logic as reference source + validation oracle |
| D9 | Decouple admin from themed UI + design-system skill | ✅ Accepted | Kills the design-language contamination vector |

## 4. Target Architecture

### 4.1 Package scope

| Package | Current | Target | Notes |
|---------|---------|--------|-------|
| `core` | published | keep | Runtime lib — the moat |
| `create-app` (CLI) | published | keep | Launcher |
| `config` | scaffolded | keep | Env config |
| `db` | scaffolded | keep | Prisma |
| `web` (base) | scaffolded | keep | Next.js base + logo |
| `worker` | scaffolded | keep (opt-in) | Queues |
| `ui` | scaffolded | keep (opt-in) | Public-page theming only |
| `admin` | scaffolded | keep (opt-in, operations shell) | Decision layer |
| `bookings` | scaffolded | **skill-only** | Vertical |
| `crm` | scaffolded | **skill-only** | Vertical |
| `cms` | scaffolded | **skill-only** | Vertical |
| `ai` | scaffolded | **skill-only** | Vertical |

### 4.2 CLI map

**Current:**
```
create <name>
  └─ multiselect: [ui] [jobs] [admin] [cms] [crm] [ai]
add <feature>
update | update --check | update --scaffold-check
flags: --no-prompts --packages --skip-install --skip-docker
```

**Target:**
```
create <name>                          # Human View: product-shaped questions + advanced
  └─ "Describe your app in a sentence or two."  → brief → MAIN.md
  └─ [advanced] full package/custom config
create <name> --packages crm,ai        # AI View: deterministic params
create <name> --preset client-work     # AI View: preset bundle
create <name> --prompt "..."           # AI View: brief from prompt
add <feature>                          # add a domain starter / package later
skill <feature>                        # print an embedded skill
update | update --check | update --scaffold-check
flags: --no-prompts --preset --packages --prompt --skip-install --skip-docker
```

### 4.3 Admin structure (target)

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
- **Open:** exact `--preset` bundles (client-work / internal-tool / product / minimal) and their feature mappings.
- **Open:** whether `worker` stays opt-in or moves to a starter.
- **Locked:** the archived originals live in `reference/` at the monorepo root (keeps the archive with the code; F4 creates it).
