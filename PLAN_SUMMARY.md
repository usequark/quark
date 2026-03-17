# Quark Plan — Executive Summary

## The Core Issue

Quark's `packages/ui` template was never built out properly. It contains one `Button` component and has been ignored. Every admin/observability proposal assumed Tailwind + Shadcn components existed — they don't.

**Solution:** Expand the UI template to ~12 primitives (Phase 0). Admin is scaffolded as a local workspace package that depends on it — no publishing required.

---

## Seven-Phase Build Plan

| Phase | Work | Effort | New Deps | Status |
|-------|------|--------|----------|--------|
| **0** | Expand UI template to ~12 primitives | 1 week | None | Planning |
| **1** | Queue metrics + health checks in `@techstream/quark-core` | 3 days | None | Planning |
| **2** | Scaffold `packages/admin/` via CLI — self-scaling CRUD UI | 2–3 weeks | None | Planning |
| **3** | Alerting engine + adapters in `@techstream/quark-core` | 2 weeks | None | Planning |
| **4** | `@techstream/quark-ai` — AI provider abstraction (published npm) | 2 weeks | `ai` SDK (optional peer) | Planning |
| **5** | Quark Observe — open-source observability (Umami model) | 6–8 weeks | Separate repo | Planning |
| **6** | Quark Cloud — managed infra + compute | 8–12 weeks | Partner APIs | Planning |

**Phases 0–4: ~8–9 weeks (pre-monetization framework work)**
**Phases 5–6: ~14–20 weeks (monetization products)**

---

## Package Distribution

| Package | Type | Optional? | Requires |
|---|---|---|---|
| `@techstream/quark-core` | Published (npm) | No | — |
| `@techstream/quark-create-app` | Published (npm) | No | — |
| `@techstream/quark-ai` | Published (npm) | **Yes** | `quark-core` |
| `@yourapp/ui` | Scaffolded (CLI) | **Yes** | — |
| `@yourapp/admin` | Scaffolded (CLI) | **Yes** | **`ui`** |
| `@yourapp/config` | Scaffolded (CLI) | No | — |
| `@yourapp/db` | Scaffolded (CLI) | No | — |
| `@yourapp/jobs` | Scaffolded (CLI) | Yes | — |
| `@yourapp/worker` | Scaffolded (CLI) | No | — |

---

## What Gets Built

### Phase 0: UI Template Expansion (~1 week)

Expand the scaffolded `packages/ui/` template. Components Tailwind-only, dependency-free, Server Component safe. Included automatically when `admin` is selected by the CLI.

```
Button (exists), Input, Select, Checkbox, Badge, Card, Table, Dialog, Toast, Label, Textarea, Skeleton
```

Admin depends on this as a workspace package (`@yourapp/ui`). No npm publishing needed.

### Phase 1: Queue Metrics (~3 days)

Add three missing metrics to `quark-core`:
- Job queue depth (how many jobs are waiting)
- Jobs processed total (counter)
- Job processing duration (histogram)

Auto-instrument the queue worker. Metrics exposed via `/api/metrics`.

### Phase 2: Admin Package (~2–3 weeks)

New CLI feature: `admin`. Scaffolds `packages/admin/` as a local workspace package. Requires `ui`.

**How it works:**
1. Reads Prisma schema at runtime from `prisma._dmmf` (no new deps)
2. Discovers all models automatically
3. Generates CRUD pages with tables, forms, edit dialogs
4. Smart field rendering: Strings → text inputs, Dates → datetime inputs, Enums → dropdowns, FKs → related model select
5. Hides sensitive fields (`password`, `@admin.hidden`)
6. Two route files scaffolded in `apps/web/src/app/admin/`
7. Selecting `admin` in the CLI automatically includes `ui` (cannot be deselected)

Refresh browser after adding a new model to `schema.prisma` → admin page appears automatically.

### Phase 3: Alerting (~2 weeks)

Framework in `@techstream/quark-core`. Adapter pattern (same as error-reporter).

Built-in adapters: Email, Webhook, Slack, PagerDuty.

```javascript
alerting.use(emailAdapter({ from: '...' }));
alerting.addRule({ 
  condition: snap => snap.get('app_errors_total') > 50,
  actions: ['email'],
  throttle: 300_000
});
```

### Phase 4: Quark Observe (Deferred → Phase 5–6)

**Quark Observe (Phase 5):** Open-source observability platform following the Umami model — self-hostable with `docker compose up`, SaaS for zero-ops. Modules ship incrementally: error tracking → metrics → uptime → analytics → AI metrics. Priced at $19/mo flat (Pro) for indie devs.

**Quark Cloud (Phase 6):** Managed full-stack infrastructure — web, worker, Postgres, Redis, storage. One-click deploy via CLI. Convenience product, not necessity. $39/mo flat bundle.

**`@techstream/quark-ai` (Phase 4):** Published npm package. Thin AI provider abstraction — unified API for OpenAI, Anthropic, Google, Ollama. Streaming, token counting, structured outputs, embeddings. Free and optional.

---

## Answers to Key Questions

| Q | A |
|---|---|
| Should admin/observe use the UI package? | **Yes.** The UI template is expanded in Phase 0. Admin depends on it as a workspace package. |
| Is `quark-admin` published to npm? | **No.** Scaffolded via CLI, same model as `ui`, `config`, `jobs`. Project owns the code. |
| Is `@techstream/quark-ai` published? | **Yes.** Published to npm, optional. Free. |
| How does admin discover models? | Reads `prisma._dmmf` from the instantiated client at runtime. Zero new dependencies. |
| What was wrong with previous proposals? | Proposed publishing admin to npm (should be scaffolded). Assumed Observe needed full detail now. Ignored the empty UI template. |
| When is Observe planned in detail? | Phase 5 — after AI package ships and Phases 1–3 are live. Umami model: self-hostable first. |
| When is Cloud planned in detail? | Phase 6 — after Observe MVP is live. |

---

## What Changes For Quark

**Distribution model: unchanged.** All packages except `quark-core`, `quark-create-app`, and `quark-ai` are scaffolded locally via the CLI. Admin follows the same pattern.

**Published packages (now 3):**
- `@techstream/quark-core` — add queue metrics + alerting
- `@techstream/quark-create-app` — add `admin` feature prompt + expanded UI template
- `@techstream/quark-ai` — AI provider abstraction (new, optional)

**Scaffolded features (increases from 2 to 3):**
- Old: `jobs`, `ui`
- New: `jobs`, `ui`, `admin` (all optional; `admin` requires `ui` and forces it on)

**CLI template changes:**
- `templates/ui/` expanded from 1 to ~12 components
- New `templates/admin/` directory added
- Selecting `admin` auto-selects and locks `ui`
- Two admin route files scaffolded into `apps/web/src/app/admin/`

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `prisma._dmmf` is internal API | Pin `@prisma/client` version; add integration test; monitor Prisma majors |
| Admin routing conflict with project routes | Admin namespaced under `/admin/*`; low conflict risk |
| Alert in-memory state lost on restart | Design choice. Persistent history is Observe's job. |
| UI template is a one-time scaffold — no auto-updates | Known tradeoff of the model. Document clearly. Bug fixes applied manually from updated template. |

---

**Reference:** See [PLAN.md](PLAN.md) for full details, rationale, and component specs.
