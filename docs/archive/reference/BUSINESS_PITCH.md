# Quark: Business Pitch & Strategy

**Date:** March 16, 2026  
**Version:** 2.0  
**Status:** Draft for Review

---

## Executive Summary

Quark is a **full-stack JavaScript framework** that solves the most painful problem in modern web development: **infrastructure consistency across projects**. Instead of wiring together auth, queues, validation, storage, and security from scratch for every new app, teams scaffold a production-ready monorepo in under 60 seconds and own 100% of the code.

**Where we are today:** Quark is not a concept. The framework is at **V2 MVP** with two packages live on npm (`@techstream/quark-core` v2.2.0, `@techstream/quark-create-app`). Auth, queues, validation, email, storage, error handling, metrics, logging, rate limiting, CSRF - all shipping. The foundation is built. This pitch is about **monetizing an existing product**, not building one from scratch.

**The opportunity:** AI is transforming what apps can do, but teams still spend weeks on boilerplate before writing a single AI feature. Quark eliminates that gap - and its consistent, predictable project structure makes it the ideal foundation for AI coding tools to build on.

**The business model:** Quark is fully open-source (MIT). Revenue comes from two self-serve products, launched sequentially:

1. **Quark Observe** - Open-source observability platform (self-hostable). SaaS version for teams that want zero-ops monitoring. Clean, affordable, does 90% of what you need - in one dashboard.
2. **Quark Cloud** - Managed full-stack infrastructure (web, worker, Postgres, Redis, storage). One-click deploy via CLI.

**Launch sequence:**
- **Phase 1 (Month 1–2):** Official open-source launch with existing framework + `@techstream/quark-ai`
- **Phase 2 (Month 3–5):** Quark Observe as first paid product
- **Phase 3 (Month 6–9):** Quark Cloud as second paid product

No consulting. No training. No lock-in. Everything self-hostable. Quark Cloud is the path of least resistance, not the only path. Paid tiers are convenience, not necessity.

---

## Part 1: The Product

### What Quark Is

Quark is a **Core-Only Registry** framework. Two npm packages are published; everything else is scaffolded locally into the developer's project.

| Published (npm) | Purpose |
|---|---|
| `@techstream/quark-core` | Runtime library: auth, queues, errors, validation, email, storage, metrics, logging, rate limiting, CSRF |
| `@techstream/quark-create-app` | CLI: scaffolds new projects, provides update commands |

| Scaffolded (local) | Purpose |
|---|---|
| `@yourapp/db` | Prisma schema + PostgreSQL client (developer owns their models) |
| `@yourapp/config` | Environment config, per-environment defaults |
| `@yourapp/jobs` | BullMQ job definitions + handlers |
| `@yourapp/ui` | Tailwind component library (Button, Input, Card, Table, etc.) |
| `@yourapp/web` | Next.js 16 app (App Router, Server Actions) |
| `@yourapp/worker` | BullMQ background worker process |

**What you get in 60 seconds:**

```bash
npx @techstream/quark-create-app my-app
cd my-app && docker compose up -d && pnpm dev
```

- Next.js 16 web app with App Router
- BullMQ worker for background jobs
- PostgreSQL 16 + Prisma 7 (with migrations)
- Redis 7 (caching + job queue)
- NextAuth v5 (JWT auth, multiple providers)
- Zod validation on all endpoints
- CSRF protection, rate limiting, security headers
- Structured logging + Prometheus metrics
- S3-compatible file storage (local dev, R2/S3 production)
- Email service (Mailpit for dev; pluggable providers - SMTP, Zeptomail, Resend)
- GitHub Actions CI/CD (lint, test, build, deploy)
- Turborepo build orchestration

### The Distribution Model

```
┌───────────────────────────────────────────────────┐
│  Your Application (you own this code)             │
│  ├── apps/web          (Next.js)                  │
│  ├── apps/worker       (BullMQ)                   │
│  ├── packages/db       (Prisma - your models)     │
│  ├── packages/config   (your env config)          │
│  ├── packages/jobs     (your job handlers)        │
│  └── packages/ui       (your components)          │
├───────────────────────────────────────────────────┤
│  @techstream/quark-core (from npm - we maintain)  │
│  auth | queues | validation | errors | storage    │
│  metrics | logging | rate-limiting | CSRF | email │
├───────────────────────────────────────────────────┤
│  Infrastructure (your choice)                     │
│  PostgreSQL | Redis | S3/R2 | SMTP                │
│  Deploy on: Railway, Render, AWS, Vercel, VPS     │
└───────────────────────────────────────────────────┘
```

### What Makes This Different

**The core insight:** Infrastructure code (auth setup, queue factories, error handling, validation) is the same across 90% of projects. Domain code (database models, job handlers, UI) is unique to every project.

Quark publishes the infrastructure and scaffolds the domain. You get centralized updates for the hard parts (`pnpm update @techstream/quark-core`) and full ownership of the custom parts.

**No lock-in.** A Quark project is a standard Node.js monorepo. Remove `@techstream/quark-core` from `package.json` and replace the 8 imports - you've ejected. There is no proprietary runtime, no custom build system, no platform dependency.

### Current Status (V2 MVP)

| Component | Status | Details |
|---|---|---|
| `@techstream/quark-core` | **✅ Published (v2.2.0)** | Auth, queues, errors, validation, email, storage, metrics, logging, rate limiting, CSRF |
| `@techstream/quark-create-app` | **✅ Published** | CLI scaffolder with feature selection |
| `@yourapp/ui` template | ⚠️ Minimal | 1 Button component - expansion planned (Phase 0 in PLAN.md) |
| `@yourapp/admin` template | 🔲 Planned | Self-scaling CRUD admin UI - depends on expanded UI package |
| `@techstream/quark-ai` | 🔲 Planned | AI provider abstraction - target: Phase 1 launch |
| Quark Observe | 🔲 Planned | Observability platform - target: Phase 2 |
| Quark Cloud | 🔲 Planned | Managed infrastructure - target: Phase 3 |

**Framework expansion plan (pre-monetization):**

| Phase | Work | Effort | Status |
|---|---|---|---|
| **0** | Expand UI package to ~12 primitives | 1 week | Planning |
| **1** | Queue metrics + health checks in `quark-core` | 3 days | Planning |
| **2** | Scaffold `packages/admin/` via CLI | 2–3 weeks | Planning |
| **3** | Alerting engine + adapters in `quark-core` | 2 weeks | Planning |

The UI package, Admin UI, and AI package are all **optional** features selected during scaffolding. Admin requires UI. None require paid tiers.

---

## Part 2: The Market

### Problem Statement

Building a modern full-stack JavaScript application requires wiring together 10+ tools before writing business logic:

| Concern | Typical Solution | Setup Time |
|---|---|---|
| Authentication | NextAuth / Clerk / Auth0 | 2–4 hours |
| Database | Prisma + PostgreSQL | 1–2 hours |
| Background jobs | BullMQ + Redis | 2–3 hours |
| Input validation | Zod schemas | 1–2 hours per endpoint |
| Error handling | Custom error classes | 1–2 hours |
| File uploads | Multer / Busboy + S3 | 3–4 hours |
| Email | Nodemailer + templates | 2–3 hours |
| Rate limiting | Custom middleware | 1–2 hours |
| Security headers | Helmet / custom | 1 hour |
| CSRF protection | Custom tokens | 1–2 hours |
| Logging | Winston / Pino | 1 hour |
| Metrics | Prometheus client | 2–3 hours |
| CI/CD | GitHub Actions | 2–4 hours |
| Monorepo setup | Turborepo + pnpm | 2–3 hours |
| **Total** | | **22–37 hours** |

**With Quark:** 60 seconds. All of the above is scaffolded and configured.

### The AI Opportunity

The rise of AI applications has made this problem worse, not better. Teams that want to build AI-powered features (chatbots, document analysis, content generation, intelligent agents) still need the same infrastructure foundation - plus additional concerns:

| AI-Specific Concern | What's Needed |
|---|---|
| LLM API integration | Provider abstraction, streaming, retries |
| Token cost management | Per-request counting, budgets, alerts |
| Structured output validation | Zod schemas for LLM responses |
| Vector embeddings | pgvector + Postgres integration |
| Prompt management | Versioning, A/B testing, rollback |
| AI observability | Latency tracking, error rates, cost dashboards |

**Quark's position:** The infrastructure layer is already solved. AI integration becomes a feature problem, not an infrastructure problem. Teams can focus on "what should my AI do?" rather than "how do I set up auth and a database first?"

### AI Compliance: The Framework AI Coding Tools Build On

This is not a secondary benefit - it is a **first-class differentiator** with its own product roadmap.

AI coding assistants (Claude Code, GitHub Copilot, Cursor) work best with predictable, well-documented codebases. Quark is deliberately designed to be the ideal substrate:

| Factor | Quark's Advantage |
|---|---|
| **Consistent patterns** | Every Quark project has the same structure, same conventions, same file locations |
| **Clear boundaries** | Monorepo packages have explicit import paths (`@yourapp/db`, `@techstream/quark-core`) |
| **Typed validation** | Zod schemas serve as machine-readable contracts |
| **Documented conventions** | `copilot-instructions.md`, `ARCHITECTURE.md`, skill files |
| **Standard tooling** | Biome (linting), Node.js test runner, Turborepo - all well-known to LLMs |
| **No magic** | No custom compilers, no proprietary DSLs, no hidden build steps |

#### Concrete Artifacts (Shipped with Every Quark Project)

Every scaffolded Quark project includes AI context files that make coding assistants immediately productive:

| Artifact | Purpose |
|---|---|
| `.github/copilot-instructions.md` | GitHub Copilot project-level instructions: conventions, import patterns, test patterns |
| `CLAUDE.md` | Claude Code project context: architecture overview, package boundaries, common tasks |
| `.cursorrules` | Cursor rules: coding standards, framework patterns, preferred libraries |
| `docs/ARCHITECTURE.md` | Machine-readable architecture overview: package map, dependency graph, conventions |
| `.github/skills/quark-context/SKILL.md` | Deep technical context for AI agents: full stack reference, patterns, anti-patterns |

#### Why This Matters (Demo Concept)

A developer using Claude Code on a Quark project can say:

> "Add a Stripe billing page with a checkout flow and webhook handler"

Because Claude Code knows:
- Routes go in `apps/web/src/app/`
- Server actions go in the same directory
- Validation uses Zod (from `@techstream/quark-core`)
- The database is Prisma (in `@yourapp/db`)
- Background jobs go in `@yourapp/jobs` and are processed by `@yourapp/worker`
- Environment config lives in `@yourapp/config`

...it can scaffold the entire feature correctly on the first attempt. On a bare Next.js project, the same request produces hallucinated file paths, missing imports, and inconsistent patterns.

**Positioning:** *"AI builds your features. Quark is the foundation it builds on."*

**Marketing strategy:**
- Ship context files with every scaffold (zero effort for developers)
- Publish a blog post / video: "Claude Code scaffolds a feature in 3 minutes on Quark vs 15 minutes on bare Next.js"
- Position in README and landing page as a top-3 value prop, not a footnote
- Maintain context files as part of the `quark-core` update cycle

---

## Part 3: Competitive Analysis

### Framework Competitors

| Framework | Strengths | Weaknesses | AI Story |
|---|---|---|---|
| **Next.js (Vercel)** | Market leader, excellent DX, massive ecosystem | Frontend-focused - backend is DIY. No auth, no queues, no jobs, no email, no storage out of the box | Vercel AI SDK (frontend streaming only) |
| **Ruby on Rails** | Mature, opinionated, "convention over configuration" | Aging frontend (Hotwire), no modern observability, Ruby ecosystem shrinking | None (community gems) |
| **Laravel** | PHP ecosystem leader, excellent docs | PHP-only, no JS/TS, limited modern frontend | None |
| **Wasp** | React + Node scaffold, similar concept | Immature (small team), limited ecosystem, custom DSL (lock-in risk) | Built-in OpenAI helpers |
| **RedwoodJS** | Full-stack React + GraphQL | GraphQL-first (divisive), complex setup, smaller community | None |
| **Blitz.js** | Next.js superset, full-stack | Stalled development, small community | None |
| **Payload CMS** | TypeScript, self-hosted headless CMS, admin UI included | CMS-first (not general-purpose), opinionated data model, heavier than needed for most apps | None |
| **T3 Stack** | TypeScript-first, popular template | Just a template (no updates after scaffold), no queue/jobs/email/storage | None |
| **create-t3-app** | Quick start | No ongoing maintenance story, no background jobs, no email | None |

### Quark's Differentiators

| Differentiator | Quark | Next.js | Rails | T3 Stack | Wasp |
|---|---|---|---|---|---|
| Full-stack scaffold | ✅ | ❌ (frontend only) | ✅ | Partial | ✅ |
| Centralized infra updates | ✅ (`pnpm update`) | N/A | ✅ (`bundle update`) | ❌ | ✅ |
| Background job queue | ✅ (BullMQ) | ❌ | ✅ (Sidekiq) | ❌ | ❌ |
| Built-in auth | ✅ (NextAuth v5) | ❌ | ✅ (Devise) | ✅ (NextAuth) | ✅ |
| Built-in email | ✅ (Nodemailer + templates) | ❌ | ✅ (ActionMailer) | ❌ | ✅ |
| Built-in file storage | ✅ (S3/R2 + local) | ❌ | ✅ (ActiveStorage) | ❌ | ❌ |
| Built-in metrics | ✅ (Prometheus) | ❌ | ❌ | ❌ | ❌ |
| Built-in security | ✅ (CSRF, rate limit, headers) | Partial | ✅ | ❌ | Partial |
| Monorepo ready | ✅ (Turborepo) | Manual | ❌ | ❌ | ❌ |
| Own your code | ✅ | ✅ | ✅ | ✅ | ❌ (DSL) |
| Zero vendor lock-in | ✅ | ❌ (Vercel optimized) | ✅ | ✅ | ❌ |
| AI-agent friendly codebase | ✅ | Partial | ❌ | Partial | ❌ |
| JS/TS ecosystem | ✅ | ✅ | ❌ (Ruby) | ✅ | ✅ |

### Why Not Just Use Laravel or Rails?

This is the most common objection from experienced developers, and it's legitimate. Laravel and Rails are mature, battle-tested frameworks with enormous ecosystems. Here's the honest comparison:

**What you lose by choosing Laravel/Rails over Quark:**

| Concern | Laravel/Rails | Quark |
|---|---|---|
| **Language** | PHP (Laravel) or Ruby (Rails) | JavaScript/TypeScript end-to-end - same language for frontend, backend, jobs, and infra config |
| **Frontend** | Blade + Livewire (Laravel) or Hotwire (Rails) - bolted-on JS when needed | Next.js App Router - native React, Server Components, streaming |
| **Job queue** | Horizon (Laravel) or Sidekiq (Rails) - excellent, but different language from frontend | BullMQ - same language, same debugging tools, same ecosystem |
| **Type safety** | Partial (PHP 8 types, Ruby Sorbet) | Zod + TypeScript end-to-end - validated at runtime, typed at dev time |
| **AI ecosystem** | Community packages, no first-class story | `@techstream/quark-ai` + Zod schemas + pgvector - AI-native from scaffold |
| **Modern deployment** | Forge/Vapor (Laravel), Heroku (Rails) | Vercel, Railway, Render, Fly - modern JS-native platforms |
| **Hiring** | PHP/Ruby developers (shrinking pool) | JavaScript developers (largest pool, still growing) |
| **AI coding tools** | AI tools produce worse PHP/Ruby than JS/TS (smaller training data, less common patterns) | Purpose-built for AI-assisted development (context files, predictable structure) |

**What you gain with Laravel/Rails:**

- Larger ecosystem of packages and integrations (decades of community)
- More battle-tested in enterprise environments
- Better documentation (Laravel especially)
- Convention over configuration at a deeper level (migrations, seeders, factories)

**Bottom line:** If your team is already proficient in PHP or Ruby and doesn't need modern React frontends or AI features, Laravel or Rails is a perfectly valid choice. Quark is for teams that want to stay in the JavaScript ecosystem and get the same "batteries included" experience that Laravel/Rails developers enjoy - with the addition of AI-readiness and modern frontend tooling.

### Infrastructure Competitors (Managed Services)

| Service | Postgres | Redis | Storage | Observability | Pricing (entry) |
|---|---|---|---|---|---|
| **Railway** | ✅ $5/mo | ✅ $5/mo | ❌ | Basic logs | $5/mo per service |
| **Render** | ✅ $7/mo | ✅ $10/mo | ❌ | Basic logs | $7/mo per service |
| **Supabase** | ✅ Free–$25/mo | ❌ | ✅ (built-in) | Basic dashboard | Free–$25/mo |
| **Neon (Postgres)** | ✅ Free–$19/mo | ❌ | ❌ | Query analytics | Free–$19/mo |
| **Upstash (Redis)** | ❌ | ✅ Free–$10/mo | ❌ | Basic | Free–$10/mo |
| **PlanetScale** | ✅ $39/mo | ❌ | ❌ | Query insights | $39/mo |
| **Vercel Postgres** | ✅ (Neon) $0–$46 | ✅ (Upstash) $0–$10 | ✅ (Blob) $0–$20 | Built-in | Bundled in Vercel plan |
| **AWS (RDS + ElastiCache)** | ✅ ~$15/mo min | ✅ ~$15/mo min | ✅ (S3) | CloudWatch | ~$30/mo minimum |
| **Quark Cloud (proposed)** | ✅ $10/mo | ✅ $5/mo | ✅ $5/mo | Quark Observe | $10–20/mo |

### Observability & Monitoring Competitors

Quark Observe aims to consolidate the functionality teams currently need 4–5 separate tools for:

| Concern | Typical Tool | Price | Quark Observe |
|---|---|---|---|
| **Error tracking** | Sentry | $26–$80/mo | ✅ Included |
| **Uptime monitoring** | Uptime Kuma / Better Stack | $0–$25/mo (self-host or SaaS) | ✅ Included |
| **Application metrics** | Datadog / New Relic | $31+/host/mo | ✅ Included |
| **Web analytics** | Umami / Plausible | $9–$19/mo | ✅ Included |
| **AI/LLM tracking** | Langfuse / Helicone | $59–$120/mo | ✅ Included |
| **Infrastructure metrics** | Prometheus + Grafana | Free (self-host) / $29/mo (cloud) | ✅ Included |
| **Combined cost** | - | **$125–$275/mo** | **$19/mo** |

**Full comparison:**

| Service | Error Tracking | Uptime | App Metrics | Web Analytics | AI Metrics | Alerting | Price |
|---|---|---|---|---|---|---|---|
| **Datadog** | ✅ (add-on) | ✅ (add-on) | ✅ | ❌ | ❌ | ✅ | $31+/host (adds up fast) |
| **Sentry** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | $26–$80/mo |
| **Uptime Kuma** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | Free (self-host) |
| **Better Stack** | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | $25/mo |
| **Umami** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | $9/mo |
| **Grafana Cloud** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | $29/mo |
| **Langfuse** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | $59/mo |
| **Helicone** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | $88–$120/mo |
| **Quark Observe** | **✅** | **✅** | **✅** | **✅** | **✅** | **✅** | **$19/mo** |

**Key insight:** Today, a team running a Quark app with AI features typically uses Sentry ($26) + Better Stack ($25) + Grafana ($29) + Plausible ($9) + Langfuse ($59) = **$148/mo across 5 dashboards**. Quark Observe doesn't claim feature parity with Sentry or Datadog. The positioning is deliberate: open-source first, self-hostable, clean UI, does 90% of what you need, in one place, at a fraction of the cost. Good enough for most - and that's a feature, not a limitation.

---

## Part 4: Deployment Compatibility

### Can Quark Run on Vercel?

**Short answer:** Yes - with a redesigned worker strategy.

The Next.js web app runs natively on Vercel. The challenge is the BullMQ worker, which is a long-running Node.js process. Vercel has no persistent compute. Here's the solution:

#### Worker Strategy for Vercel Users

**Option A: Quark Cloud Worker (Recommended)**

Vercel hosts the web app. Quark Cloud hosts the worker + managed Postgres + Redis.

```
┌─────────────┐     ┌─────────────────────────────┐
│  Vercel     │     │  Quark Cloud                │
│  apps/web   │ ──→ │  apps/worker (managed)      │
│  (Next.js)  │     │  PostgreSQL  (managed)      │
│             │     │  Redis       (managed)      │
│             │     │  Storage     (R2)           │
└─────────────┘     └─────────────────────────────┘
```

This is the ideal customer experience for Vercel users:
- `quark deploy vercel` → deploys web to Vercel
- `quark deploy cloud --worker --infra` → provisions worker + Postgres + Redis on Quark Cloud
- One CLI command, two platforms, fully connected

**Option B: Vercel Functions + Upstash (Serverless Worker)**

For teams that want everything on Vercel, we can redesign the worker to use:
- **Vercel Cron Jobs** (scheduled tasks, replaces BullMQ repeatable jobs)
- **Upstash QStash** (serverless message queue, replaces BullMQ for async jobs)
- **Vercel Functions** (job handlers run as serverless functions)

This requires an alternative worker adapter in Quark Core:

```javascript
// Current: BullMQ worker (long-running process)
const worker = createWorker(queue, handler, { concurrency: 5 });

// Alternative: Serverless worker (Vercel-compatible)
// Job dispatched via QStash → hits /api/jobs/[name] route → executes handler
export async function POST(request) {
  const { name, data } = await request.json();
  const handler = jobHandlers[name];
  return handler(data);
}
```

The CLI would scaffold the appropriate worker based on deployment target:
- Railway/Render/Docker → BullMQ worker (current model)
- Vercel → Serverless worker adapter (API routes + QStash/Cron)
- Quark Cloud → Managed BullMQ worker

**Option C: External Worker (Self-Managed)**

Developer hosts the worker wherever they choose (Railway, Render, VPS, etc.). Quark provides the deployment config.

#### Next.js Config for Vercel

The current config uses `output: "standalone"` (for Railway's Docker-based deploys). For Vercel, this should be conditional:

```javascript
const nextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
};
```

### Deployment Matrix

| Platform | Web | Worker | Postgres | Redis | One-Command? |
|---|---|---|---|---|---|
| **Railway** | ✅ | ✅ (BullMQ) | ✅ | ✅ | `quark deploy railway` |
| **Render** | ✅ | ✅ (BullMQ) | ✅ | ✅ | `quark deploy render` |
| **Vercel + Quark Cloud** | ✅ (Vercel) | ✅ (Quark Cloud) | ✅ (Quark Cloud) | ✅ (Quark Cloud) | `quark deploy vercel` |
| **Vercel (fully serverless)** | ✅ | ✅ (Functions + QStash) | ⚠️ (Neon) | ⚠️ (Upstash) | `quark deploy vercel --serverless` |
| **Fly.io** | ✅ | ✅ (BullMQ) | ✅ | ✅ | `quark deploy fly` |
| **Docker (VPS)** | ✅ | ✅ (BullMQ) | ✅ | ✅ | `quark deploy docker` |
| **Quark Cloud (full)** | ✅ | ✅ (BullMQ) | ✅ | ✅ | `quark deploy cloud` |

---

## Part 5: Product Strategy

### What We Ship (All Free, Open-Source)

#### 1. Quark Framework

Everything described in Part 1. Fully open-source (MIT). This is the adoption engine.

**Includes (bundled in scaffold, not premium):**
- **Admin UI** - Auto-generated CRUD dashboard from Prisma schema (scaffolded via CLI)
- **Integrations** - Pre-built connectors for Stripe, Twilio, Slack, SendGrid, Airtable (scaffolded via CLI)
- **AI Templates** - RAG chat, document analysis, content generator, streaming UI (scaffolded via CLI)
- **Deployment configs** - Railway, Render, Vercel, Fly.io, Docker, AWS templates

**Why free?** Admin UI and Integrations are core value propositions that drive adoption. Gating them reduces onboarding conversion. Every team that scaffolds a Quark project should see immediate value.

#### 2. `@techstream/quark-ai` (Free npm Package)

A thin abstraction layer for adding AI features to Quark apps:

| Feature | What It Does |
|---|---|
| **Provider abstraction** | Unified API for OpenAI, Anthropic, Google, Ollama (self-hosted) |
| **Streaming** | Server-sent events, token-by-token UI updates (built on Next.js App Router) |
| **Token counting** | Per-request token accounting, model-aware pricing |
| **Structured outputs** | Zod schema → LLM function calls + response validation |
| **Embeddings** | pgvector integration (uses existing `@yourapp/db`) |
| **Prompt versioning** | File-based or DB-backed prompt management |
| **Cost tracking** | Per-request cost calculation, exportable to Observe |

**Why free?** This drives the AI positioning. "The framework that makes AI features easy" only works if the AI tooling is accessible to everyone.

#### 3. `quark deploy` (Free CLI Command)

One-command deployment to any platform:

```bash
quark deploy              # Interactive wizard
quark deploy railway      # Direct deploy
quark deploy vercel       # Vercel (web) + prompts for worker host
quark deploy cloud        # Quark Cloud (managed hosting)
```

**Why free?** It's the on-ramp to Quark Cloud (our paid managed hosting).

---

### What We Sell (Self-Serve, Scalable)

#### Product 1: Quark Observe - Open-Source Observability Platform

**Positioning:** *"Open-source observability for full-stack teams. Self-hostable, clean, affordable. One dashboard for errors, uptime, metrics, analytics, and AI costs."*

Quark Observe does not aim to replace Sentry or compete with Datadog. It aims to be **good enough for 90% of teams**, in one place, with a clean UI and an honest price. Teams that outgrow it can export data and move to specialized tools - no lock-in.

**The open-source-first model:**
- Open-source (MIT). Self-host with a single `docker compose up`.
- SaaS version for teams that want zero-ops: managed hosting, longer retention, multi-region uptime checks.
- Priced for indie developers and small teams, not enterprises with six-figure budgets.
- Each module is useful on its own. Ship incrementally - error tracking first, then metrics, then analytics.

**What it does:**

| Module | Replaces | What It Does |
|---|---|---|
| **Error Tracking** | Sentry | Capture, group, and alert on exceptions. Stack traces, breadcrumbs, source maps. Assignable to team members. |
| **Uptime Monitoring** | Uptime Kuma / Better Stack | HTTP(S) health checks, response time tracking, status pages, downtime alerts. |
| **Application Metrics** | Prometheus + Grafana | Request volume, latency (p50/p95/p99), error rates, queue depth, job throughput. Time-series dashboards. |
| **Web Analytics** | Umami / Plausible | Page views, unique visitors, referrers, device/browser breakdown. Privacy-friendly (no cookies). |
| **AI Metrics** | Langfuse / Helicone | Token usage (input/output), cost per request, latency by model/provider, prompt effectiveness. |
| **Alerting** | PagerDuty / OpsGenie | Slack, email, webhook, PagerDuty. Configurable thresholds & escalation. |

**Detailed metrics:**

| Category | Metrics |
|---|---|
| **Errors** | Exception count, error grouping, stack traces, affected users, first/last seen, status (open/resolved/ignored) |
| **Uptime** | Endpoint health, response time, uptime %, status page, SSL expiry, downtime history |
| **HTTP** | Request volume, latency (p50/p95/p99), error rates, status codes, slow endpoints |
| **Database** | Query count, slow queries, connection pool usage, migration status |
| **Queue** | Job throughput, failure rate, processing time, queue depth, stalled jobs |
| **Auth** | Login attempts, session creation, failed auth, active sessions |
| **AI (LLM)** | Token usage (input/output), cost per request, latency by model, error rates by provider |
| **AI (Cost)** | Daily/weekly/monthly spend, projections, budget alerts, cost-per-feature breakdown |
| **Web Analytics** | Page views, unique visitors, referrers, top pages, device/browser, geography |
| **Storage** | Upload volume, storage usage, bandwidth |
| **System** | Memory, CPU, event loop lag, GC pressure |

**Architecture:**

```
Your Quark App                          Quark Observe
┌───────────────────┐                   ┌──────────────────────────────────────┐
│ quark-core        │                   │  Ingest API                          │
│ ├─ metrics.js     │ ── app metrics →  │  ├─ Time-series DB (metrics)         │
│ ├─ error-reporter │ ── errors ──────→ │  ├─ Error store (grouping, traces)   │
│ ├─ logger.js      │ ── logs ────────→ │  ├─ Log store (structured, indexed)  │
│ └─ request-logger │ ── analytics ───→ │  ├─ Analytics engine (page views)    │
│                   │                   │  ├─ Uptime checker (scheduled)       │
│ quark-ai          │                   │  ├─ AI cost engine (token tracking)  │
│ └─ token tracker  │ ── AI metrics ──→ │  └─ Alert engine (Slack/email/hook)  │
└───────────────────┘                   └──────────────────────────────────────┘
                                                        │
                                                ┌───────┴───────┐
                                                │   Dashboard   │
                                                │  (React SPA)  │
                                                └───────────────┘
```

**Self-hostable:** Yes - and this is non-negotiable. The `@techstream/quark-observe` package includes the full collector + dashboard. Deploy it the same way you deploy any Quark app:

```bash
# Self-hosted Observe (same codebase as SaaS)
git clone https://github.com/Bobnoddle/quark-observe
cd quark-observe
docker compose up -d

# That's it. Dashboard at http://localhost:3200
# Add to your app's .env:
# QUARK_OBSERVE_URL=http://observe.internal:3200
```

The self-hosted version uses the same codebase as the SaaS. If the open-source version works, the SaaS version works. We dogfood the self-hosted version internally.

The SaaS version adds: multi-project aggregation, longer retention, managed uptime checks from multiple regions, team management, and zero-ops maintenance.

**Pricing - Two Models:**

We offer both flat-rate and usage-based pricing. Teams choose whichever is more predictable for their situation.

**Option A: Flat Rate (Simple, Predictable)**

| Tier | Events/mo | Retention | Projects | Price |
|---|---|---|---|---|
| **Free** | 10K | 7 days | 1 | $0 |
| **Pro** | 500K | 30 days | 10 | $19/mo per workspace |
| **Enterprise** | 5M | 90 days | Unlimited | $79/mo per workspace |

**Option B: Usage-Based (Scales With You)**

| Tier | Included Events | Overage | Retention | Price |
|---|---|---|---|---|
| **Free** | 10K/mo | - | 7 days | $0 |
| **Pay-as-you-go** | 10K/mo | $1 per 50K events | 14 days | $5/mo base |
| **Pro** | 200K/mo | $0.50 per 50K events | 30 days | $15/mo base |
| **Enterprise** | Custom | Custom | 90 days | Custom |

**Pricing comparison:**

| Monthly events | Flat Rate (Pro) | Usage-Based (Pro) | Cheaper? |
|---|---|---|---|
| 50K | $19 | $15 | Usage |
| 200K | $19 | $15 | Usage |
| 500K | $19 | $18 | Usage (barely) |
| 1M | Over limit | $23 | Flat |

**Recommendation:** Launch with flat-rate tiers (simpler to implement and explain). Add usage-based option in Phase 3 of Observe development when usage patterns are understood. Most indie developers prefer predictable pricing.

**Competitive pricing rationale:**

| Competitor | Comparable Tier | Price |
|---|---|---|
| Datadog (APM) | Pro equivalent | $31/host/mo (+ $0.10/GB logs) |
| New Relic | Pro equivalent | $0.35/GB ingested (unpredictable) |
| Grafana Cloud | Pro equivalent | $29/mo (metrics only, no AI) |
| Langfuse (AI only) | Pro equivalent | $59/mo (AI metrics only, no app metrics) |
| Helicone (AI only) | Pro equivalent | $88/mo (AI metrics only) |
| **Quark Observe** | **Pro (Flat)** | **$19/mo (app + AI metrics combined)** |

**Why Quark Observe wins:**
- **Not trying to replace Sentry.** If you need Sentry-grade error tracking with 200+ integrations, use Sentry. Observe is for teams that want "good enough" across 6 concerns in one dashboard.
- **Self-hostable first.** No vendor lock-in. Evaluate for free. Pay only for convenience.
- **Priced for indie devs.** $19/mo flat vs. Datadog's $31+/host escalation.
- **AI + app metrics in one place.** Langfuse is $59/mo for AI only. Observe includes both.

**Revenue model (flat-rate pricing, base case):**

| Year | Pro Workspaces | Enterprise | MRR | ARR |
|---|---|---|---|---|
| Y1 (month 12) | 40 | 5 | $1,155 | $13,860 |
| Y2 (month 24) | 200 | 25 | $5,775 | $69,300 |
| Y3 (month 36) | 600 | 80 | $17,720 | $212,640 |

#### Product 2: Quark Cloud - Managed Full-Stack Infrastructure

**Positioning:** *"One click to deploy your entire Quark app. The path of least resistance, not the only path."*

Quark Cloud runs the complete Quark stack. This is the answer to: "I use Vercel for my frontend - where do I put the worker, database, and Redis?"

**Important:** Quark Cloud is a **convenience product**, not a necessity. The CLI wizard shows Railway, Render, Docker, and self-hosted as equally prominent deployment options. Quark Cloud is one choice among many. The docs show self-hosted deployment first. We will never make Cloud the only path.

**What we provide:**

| Service | What | Backing |
|---|---|---|
| **Web** | Managed Next.js deployment (auto-scaling, HTTPS, custom domains) | Containerized Node.js (Railway/Fly.io partner or self-operated) |
| **Worker** | Managed BullMQ worker (auto-restart, health checks, scaling) | Containerized Node.js (same infra as web) |
| **Postgres** | Managed PostgreSQL 16, daily backups, point-in-time recovery, SSL | Neon / Supabase partnership (resell) or self-operated |
| **Redis** | Managed Redis 7, persistence, replication | Upstash partnership (resell) or self-operated |
| **Storage** | S3-compatible object storage, CDN | Cloudflare R2 (resell) or Backblaze B2 |

**Key design decisions:**
- **Standard protocols:** PostgreSQL wire protocol, Redis protocol, S3 API. No proprietary APIs.
- **Full export:** `pg_dump`, `redis-cli --rdb`, S3 sync. Leave anytime.
- **Integrated with Observe:** Infra metrics flow automatically into Observe dashboard.
- **Provisioned via CLI:** `quark deploy cloud` provisions all services + deploys app.
- **Mix and match:** Use Vercel for web + Quark Cloud for worker/infra, or Quark Cloud for everything.
- **Works alongside Vercel:** `quark deploy vercel` deploys web to Vercel and provisions worker + infra on Quark Cloud. One command, seamless.

**Pricing - Two Models:**

**Option A: Flat Bundles (Simple, Predictable)**

| Service | Free | Pro | Enterprise |
|---|---|---|---|
| **Web** | 1 instance, sleep after 30min idle | Always-on, auto-scaling, custom domain | Dedicated, HA |
| | $0 | $10/mo | Custom |
| **Worker** | 1 instance, limited concurrency | Always-on, configurable concurrency | Dedicated, HA |
| | $0 | $10/mo | Custom |
| **Postgres** | 500MB, shared | 10GB, dedicated, backups | 100GB+, HA, custom |
| | $0 | $15/mo | Custom |
| **Redis** | 100MB, shared | 1GB, dedicated | 10GB+, HA, custom |
| | $0 | $5/mo | Custom |
| **Storage** | 1GB | 50GB | 500GB+ |
| | $0 | $5/mo | Custom |
| **Full Stack Bundle** | Free tiers (all 5) | **$39/mo** (save $6) | Custom |

**Option B: Usage-Based (Pay for What You Use)**

| Resource | Free Included | Price Per Unit |
|---|---|---|
| **Compute (web + worker)** | 100 hours/mo | $0.02/hour per 256MB container |
| **Postgres storage** | 500MB | $0.15/GB/mo |
| **Postgres queries** | 1M/mo | $0.05 per million |
| **Redis storage** | 100MB | $0.30/GB/mo |
| **Object storage** | 1GB | $0.02/GB/mo |
| **Bandwidth** | 10GB/mo | $0.10/GB |

**Pricing comparison (typical indie SaaS - light usage):**

| Scenario | Flat Bundle (Pro) | Usage-Based (est.) | Cheaper? |
|---|---|---|---|
| Hobby project (low traffic) | $39 | ~$8 | Usage |
| Small SaaS (1K users) | $39 | ~$25 | Usage |
| Growing SaaS (10K users) | $39 | ~$55 | Flat |
| Scale (50K+ users) | Enterprise | Custom | Custom |

**Recommendation:** Launch with flat bundles (simpler billing, predictable revenue). Add usage-based tier in Phase 2 of Cloud development. Flat bundles perform better at scale; usage-based attracts hobbyists and early-stage projects.

**Competitive pricing rationale:**

| Provider | Web | Worker | Postgres | Redis | Storage | Total |
|---|---|---|---|---|---|---|
| Railway | $5/mo | $5/mo | $5/mo | $5/mo | N/A | $20/mo (no storage) |
| Render | $7/mo | $7/mo | $7/mo | $10/mo | N/A | $31/mo (no storage) |
| Vercel + Railway | $20/mo | $5/mo (Railway) | $20/mo (Neon) | $10/mo (Upstash) | $20/mo (Blob) | $75/mo |
| Vercel + Supabase | $20/mo | ❌ (no worker) | $25/mo | N/A | Included | $45/mo (no worker, no Redis) |
| AWS (ECS + RDS) | ~$15/mo | ~$15/mo | ~$15/mo | ~$15/mo | ~$1/mo (S3) | ~$61/mo (complex setup) |
| **Quark Cloud Bundle** | $10/mo | $10/mo | $15/mo | $5/mo | $5/mo | **$39/mo (one click)** |

**Why Quark Cloud wins:**
- **Cheaper than Vercel + services** ($39 vs $75 for full stack)
- **Includes the worker** (Vercel + Supabase can't run background jobs)
- **Simpler than AWS** (one CLI command vs. multi-service console setup)
- **More complete than Railway** (includes storage + Observe integration)
- **Integrated with Observe** (metrics flow automatically, no setup)
- **Standard protocols** (leave anytime - `pg_dump`, `redis-cli`, S3 sync)
- **Vercel companion:** `quark deploy vercel` = web on Vercel, everything else on Quark Cloud

**Revenue model (flat bundles, base case):**

| Year | Pro Bundles | Enterprise | MRR | ARR |
|---|---|---|---|---|
| Y1 (month 12) | 30 | 3 | $1,470 | $17,640 |
| Y2 (month 24) | 120 | 12 | $7,560 | $90,720 |
| Y3 (month 36) | 350 | 30 | $16,050 | $192,600 |

---

## Part 6: User Experience Vision

### CLI → Simple Wizard

```
$ npx @techstream/quark-create-app

  ╭─────────────────────────────────────╮
  │                                     │
  │        ⚛  Quark Framework           │
  │                                     │
  ╰─────────────────────────────────────╯

  Project name: my-saas-app

  What are you building?
  ● SaaS application
  ○ AI-powered app
  ○ API backend
  ○ Minimal (just the basics)

  Select features:
  ✓ Authentication (NextAuth v5)
  ✓ Background Jobs (BullMQ)
  ✓ Admin Dashboard
  ✓ AI Integration (LLM + RAG)
  ○ Stripe Billing
  ○ Email Marketing

  Where will you deploy?
  ● Railway
  ○ Vercel + Railway
  ○ Render
  ○ Quark Cloud
  ○ Docker (self-hosted)
  ○ I'll decide later

  ✔ Project scaffolded
  ✔ Dependencies installed
  ✔ Secrets generated
  ✔ Git initialized

  Next steps:
    cd my-saas-app
    docker compose up -d
    pnpm dev

  Your app is running at http://localhost:3000
```

### Quark Observe → One Click

```
$ quark observe

  Quark Observe is not configured.

  How would you like to run Observe?
  ● Use Quark Observe SaaS (recommended)
  ○ Self-host (docker compose - same codebase as SaaS)
  ○ I'll set it up myself

  → Opening browser to observe.quark.dev/setup...

  Paste this into your .env:
    QUARK_OBSERVE_KEY=obs_xxxxxxxxxxxxxxxxx

  ✔ Observe connected.
  ✔ Metrics flowing to https://observe.quark.dev/my-saas-app

  View your dashboard: https://observe.quark.dev/my-saas-app
```

### Self-Hosted Observe → One Command

```
$ quark observe --self-host

  Setting up self-hosted Quark Observe...

  ✔ Created docker-compose.observe.yml
  ✔ Observe services: collector + dashboard + TimescaleDB

  Run:
    docker compose -f docker-compose.observe.yml up -d

  Dashboard: http://localhost:3200

  Add to your app's .env:
    QUARK_OBSERVE_URL=http://localhost:3200

  ✔ Self-hosted Observe is ready.
  ✔ Same features as SaaS. Upgrade anytime.
```

### Quark Cloud → One Click

```
$ quark deploy cloud

  Provisioning your full Quark stack...

  ✔ PostgreSQL 16   → postgres://quark-xxxxx.quark.dev:5432/myapp
  ✔ Redis 7         → redis://quark-xxxxx.quark.dev:6379
  ✔ Storage (R2)    → https://storage.quark.dev/my-saas-app
  ✔ Web app         → https://my-saas-app.quark.dev
  ✔ Worker          → Running (1 instance, concurrency: 5)

  Environment variables injected automatically.
  Observe dashboard: https://observe.quark.dev/my-saas-app

  Monthly cost: $39/mo (Full Stack Bundle)
```

### Vercel + Quark Cloud → One Click

```
$ quark deploy vercel

  Deploying web to Vercel...
  ✔ Web app         → https://my-saas-app.vercel.app

  Your app needs a worker + infrastructure.
  ● Provision on Quark Cloud (recommended)
  ○ I'll handle it myself

  Provisioning backend on Quark Cloud...
  ✔ Worker          → Running (Quark Cloud)
  ✔ PostgreSQL 16   → postgres://quark-xxxxx.quark.dev:5432/myapp
  ✔ Redis 7         → redis://quark-xxxxx.quark.dev:6379
  ✔ Storage (R2)    → https://storage.quark.dev/my-saas-app

  Vercel environment variables set automatically.
  Observe dashboard: https://observe.quark.dev/my-saas-app

  Monthly cost: $29/mo (Worker + Infra Bundle, no web hosting)
```

---

## Part 7: Revenue Projections

### Base Case vs. Optimistic

All projections below use two scenarios. The business works in both - the base case just takes longer to reach meaningful revenue.

#### Framework Adoption (Scaffolded Projects)

| Metric | Base Case | Optimistic |
|---|---|---|
| Y1 scaffolded projects | 500 | 1,500 |
| Y2 scaffolded projects | 2,000 | 6,000 |
| Y3 scaffolded projects | 5,000 | 15,000 |
| GitHub stars (Month 6) | 300 | 800 |
| GitHub stars (Month 12) | 800 | 2,500 |
| npm weekly downloads (Month 6) | 150 | 500 |
| npm weekly downloads (Month 12) | 400 | 1,500 |

#### Conversion Rates

| Metric | Base Case | Optimistic | Notes |
|---|---|---|---|
| Free → Observe (paid) | 4% | 10% | Dev tool avg is 2–5%. Observe's low price helps. |
| Free → Cloud (paid) | 3% | 8% | Cloud competes with a "do it yourself" option. |
| Monthly churn (Pro) | 6% | 4% | Dev tools churn is typically 5–8%. |

#### Unit Economics Per Product

**Quark Observe:**

| Metric | Value |
|---|---|
| CAC (customer acquisition cost) | ~$0 (OSS-led, content-driven) |
| ARPU (average revenue per user) | $19–$25/mo (mix of Pro + Enterprise) |
| Gross margin | ~85% (hosting + time-series DB storage) |
| Payback period | Immediate (no acquisition spend) |
| LTV at 6% churn | ~$316 (Pro) / ~$1,316 (Enterprise) |

**Quark Cloud:**

| Metric | Value |
|---|---|
| CAC | ~$0 (OSS-led, CLI-driven) |
| ARPU | $39–$50/mo (mix of bundle + enterprise) |
| Gross margin | ~65% (resell) / ~75% (self-operated) |
| Payback period | Immediate |
| LTV at 6% churn | ~$650 (Pro bundle) |

### Combined Revenue Model (Base Case)

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| **Observe SaaS** | $13,860 | $69,300 | $212,640 |
| **Quark Cloud** | $17,640 | $90,720 | $192,600 |
| **Total ARR** | **$31,500** | **$160,020** | **$405,240** |

### Combined Revenue Model (Optimistic)

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| **Observe SaaS** | $42,000 | $210,000 | $640,000 |
| **Quark Cloud** | $52,000 | $270,000 | $576,000 |
| **Total ARR** | **$94,000** | **$480,000** | **$1,216,000** |

### What "Slow Adoption" Looks Like

If framework adoption is slower than the base case (e.g., 250 scaffolded projects in Y1), the business still works because:

1. **Observe and Cloud are independently marketable.** Any Node.js team can use Observe without using the Quark framework. Cloud can serve any Node.js monorepo project.
2. **The cost base is near-zero in Y1.** Founder-led engineering. No paid marketing. Infra costs scale with paying customers, not with free users.
3. **Developer tools compound.** A framework with 50 stars today can have 500 in six months if the content and DX are right. Early slowness doesn't predict long-term failure.

### Assumptions

| Metric | Base | Optimistic |
|---|---|---|
| Free → Observe conversion | 4% | 10% |
| Free → Cloud conversion | 3% | 8% |
| Monthly churn (Pro) | 6% | 4% |
| Observe ARPU | $21/mo | $25/mo |
| Cloud ARPU | $42/mo | $48/mo |

### Cost Structure

| Cost | Y1 | Y2 | Y3 |
|---|---|---|---|
| Infrastructure (Observe SaaS hosting) | $3,000 | $12,000 | $36,000 |
| Infrastructure (Cloud compute + resell) | $6,000 | $32,000 | $72,000 |
| AI tooling (Copilot, API costs for AI support system) | $2,400 | $3,600 | $4,800 |
| DevRel / Content (contractor, when MRR > $5K) | $0 | $30,000 | $60,000 |
| **Total Costs** | **$11,400** | **$77,600** | **$172,800** |
| **Net Margin (Base)** | **$20,100** | **$82,420** | **$232,440** |
| **Net Margin (Optimistic)** | **$82,600** | **$402,400** | **$1,043,200** |

*Y1: Solo founder + AI system (no FTEs). AI handles client interactions, triage, small fixes, and documentation PRs. Costs scale with revenue - infra grows with paying customers, not free users.*

**Note:** No external funding required. The solo + AI model keeps fixed costs minimal. Contractor DevRel/Content is added only when revenue justifies it (MRR > $5K). The base case is profitable from Y1.

### Gross Margins

| Product | Cost Basis | Gross Margin |
|---|---|---|
| Observe SaaS | ~15% (hosting + storage) | **~85%** |
| Quark Cloud (resell) | ~35% (partner wholesale + compute) | **~65%** |
| Quark Cloud (self-operated) | ~25% (raw infra) | **~75%** |
| **Blended** | | **~75%** |

---

## Part 8: Go-to-Market

**Starting point:** The framework is at V2 MVP and live on npm. This is not a pre-launch buildout - it's a monetization strategy for an existing product.

### Phase 1: Official Open-Source Launch (Month 1–2)

**Goal:** Establish public positioning, build initial community, ship `@techstream/quark-ai`. Close the onboarding gap with a first-feature guide and an incremental adoption path.

| Action | Effort | Impact |
|---|---|---|
| License change: ISC → MIT | 1 day | Enterprise trust |
| Publish `@techstream/quark-ai` to npm | 2 weeks | AI positioning |
| Ship AI context files in scaffold (`.cursorrules`, `CLAUDE.md`, etc.) | 3 days | AI-agent differentiation |
| **"First Feature" guide** - scaffold to working feature in 20 min | 3 days | Onboarding conversion |
| **Incremental adoption guide** - add `quark-core` to existing Next.js app | 3 days | Addressable market expansion |
| Landing page (quark.dev or similar) | 1 week | Lead capture |
| Documentation refresh (AI patterns, "build a chatbot in 30 min") | 1 week | SEO, developer trust |
| HN launch post + Indie Hackers | 1 day | Initial traffic |
| Discord community | 1 day | Engagement loop |

**Two acquisition funnels:**
1. **Greenfield** - `npx @techstream/quark-create-app` → full scaffold → first feature guide
2. **Incremental** - `pnpm add @techstream/quark-core` into an existing Next.js project → progressively adopt auth, email, jobs, error reporting

The incremental path is the highest-leverage addition. The largest pool of potential users already has a Next.js app they won't restart from scratch. This doesn't compete with the scaffold - it's additive, and expands the addressable audience significantly. It also strengthens the AI-agent story: an agent can add Quark features to an existing codebase, not just build greenfield.

**Target (base):** 50 scaffolded projects, 200 GitHub stars, 100 npm weekly downloads.
**Target (optimistic):** 150 scaffolded projects, 500 GitHub stars, 300 npm weekly downloads.

### Phase 2: Quark Observe MVP (Month 3–5)

**Goal:** Ship Observe as first paid product. Launch with error tracking + app metrics. Add modules incrementally.

| Action | Effort | Impact |
|---|---|---|
| Build Observe collector (npm package) | 2 weeks | Data pipeline |
| Build Observe dashboard (SaaS + self-hosted) | 3 weeks | Product |
| Self-hosted docker compose setup | 3 days | Philosophy credibility |
| Stripe billing integration | 1 week | Revenue |
| `quark observe` CLI command | 3 days | One-click UX |
| Add uptime monitoring module | 1 week | Feature expansion |
| Add web analytics + AI metrics modules | 2 weeks | Feature expansion |

**Target (base):** 20 connected apps, 5 paying workspaces, $100 MRR.
**Target (optimistic):** 80 connected apps, 20 paying workspaces, $400 MRR.

**Observe module rollout:**
- Month 3: Error tracking + application metrics (core)
- Month 4: Uptime monitoring + alerting
- Month 5: Web analytics + AI metrics

Each module is independently useful. Don't ship everything at once.

**Agency / consultancy note:** The Admin UI (Phase 2 of the build plan) and multi-tenant patterns are the two features that push agencies from "evaluating" to "standardizing." Agencies standardize on frameworks that reduce per-project setup time. Quark's auto-generated Admin UI and scaffolded multi-tenant patterns make it the default starting point for client projects. Both should be live and documented before Phase 3.

### Phase 3: Quark Cloud MVP (Month 6–9)

**Goal:** Ship managed infrastructure as second revenue stream.

| Action | Effort | Impact |
|---|---|---|
| Partner with Neon (Postgres) or operate own | 2 weeks | Postgres provisioning |
| Partner with Upstash (Redis) or operate own | 1 week | Redis provisioning |
| Cloudflare R2 integration | 1 week | Storage |
| Managed web + worker compute (containerized) | 3 weeks | Full-stack hosting |
| `quark deploy cloud` CLI command | 2 weeks | One-click deploy |
| `quark deploy vercel` (web on Vercel + Cloud worker/infra) | 1 week | Vercel compatibility |
| Billing + usage metering | 1 week | Revenue |

**Target (base):** 15 deployed apps, 5 paying bundles, $200 MRR.
**Target (optimistic):** 50 deployed apps, 20 paying bundles, $800 MRR.

### Phase 4: Growth (Month 10–18)

**Goal:** Scale adoption, optimize conversion, expand features.

| Action | Effort | Impact |
|---|---|---|
| AI template expansion (agents, RAG, chat) | Ongoing | Adoption |
| Blog + YouTube content | Ongoing | SEO, trust |
| Case studies (early adopters) | 1 day each | Social proof |
| Observe Enterprise tier | 2 weeks | Revenue |
| Cloud Enterprise tier | 2 weeks | Revenue |
| Usage-based pricing option (Observe + Cloud) | 2 weeks | Flexibility |

**Target (base):** 500 scaffolded projects, $3K MRR.
**Target (optimistic):** 1,500 scaffolded projects, $10K MRR.

---

## Part 9: Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Low adoption** - developers don't discover Quark | Medium | High | Invest in content marketing, HN launches, Discord. Framework adoption is slow but sticky. Note: Observe and Cloud are independently marketable to any Node.js team, even without framework adoption. |
| **Slow adoption** - growth is 50% of base case | Medium | Medium | The business still works: costs are near-zero in Y1 (no FTEs - solo founder + AI system), infra scales with customers. No hiring pressure. |
| **Observe SaaS competition** - Datadog/Grafana add AI metrics | Medium | Medium | Our advantage is simplicity and price, not feature depth. Datadog adding a feature doesn't make it cheaper or simpler. Observe targets indie devs, not enterprises. |
| **Vercel platform expansion** - Vercel ships queues, cron, storage, full-stack primitives | **High** | **Medium** | Vercel adding full-stack features increases lock-in to their platform. Quark's "deploy anywhere" story becomes *more* valuable, not less. The more Vercel locks in, the more developers want an escape hatch. Quark runs on Railway, Fly, Docker, VPS - and Vercel too. |
| **Infra margin compression** - providers raise wholesale prices | Low | Medium | Multi-provider strategy (Neon + Supabase, Upstash + Dragonfly). Can operate own infra if margins require it. |
| **Next.js breaking changes** - major version breaks scaffold | Medium | Low | Already handled by `quark-core` update mechanism. Monorepo structure isolates breaking changes. |
| **AI hype cycle** - market correction reduces AI app demand | Low | Medium | Quark is a full-stack framework first. AI features are additive, not the entire value prop. Teams building non-AI apps should feel equally at home. |
| **Fork competition** - someone forks and competes | Low | Low | MIT license allows this. Differentiate via Observe SaaS + Cloud (managed services can't be forked). |
| **Team burnout** - too few people, too much scope | Medium | High | Strict scope: 2 products only (Observe + Cloud). Sequential launch, not parallel. AI system handles client interactions, triage, and routine fixes - founder focuses on architecture and features. Everything else is free and community-driven. |
| **Execution speed** - solo founder shipping on projected timeline | Medium | Medium | The product thesis is validated - the risk is entirely execution speed. Mitigated by: AI-assisted development (AI handles client interactions, triage, and small fixes; founder focuses on architecture and major features), sequential launch plan, and near-zero fixed costs in Y1. |

---

## Part 10: Why Now?

1. **AI adoption is accelerating.** Every team wants to add AI features. No framework makes it easy yet.

2. **JavaScript dominates.** Node.js is the #1 runtime for web development. The market for a batteries-included JS framework is enormous.

3. **Observability is fragmenting.** Teams use 3–4 tools to monitor one app. Quark Observe consolidates AI + app metrics into one dashboard.

4. **Developer experience matters more than ever.** With 50+ SaaS tools competing for developer attention, the framework that saves the most time wins.

5. **The competition is distracted.** Vercel is focused on frontend. Rails is aging. Wasp is too small. T3 is just a template. Quark occupies a gap: modern, full-stack, AI-ready, and open.

---

## Appendix A: Technical Architecture

### Stack Summary

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 24 |
| Package Manager | pnpm | 10 |
| Monorepo | Turborepo | Latest |
| Web Framework | Next.js | 16 (App Router) |
| Database | PostgreSQL + Prisma | 16 + 7 |
| Queue | BullMQ + Redis | 5 + 7 |
| Auth | NextAuth | v5 |
| Validation | Zod | 4 |
| UI | Tailwind CSS | 4 |
| Email | Nodemailer (pluggable: SMTP, Zeptomail, Resend) | 8 |
| Storage | S3/R2 (pluggable) | - |
| Linting | Biome | Latest |
| Testing | Node.js test runner | Built-in |
| CI/CD | GitHub Actions | - |

### Security (Built-in)

- CSRF token protection
- Rate limiting (in-memory + Redis)
- Security headers (HSTS, X-Frame-Options, CSP, X-XSS-Protection)
- CORS (environment-based)
- Password hashing (bcrypt, 12 rounds)
- Input validation (Zod on all endpoints)
- SQL injection prevention (Prisma parameterized queries)
- File upload validation (magic-byte + MIME type)
- Session management (JWT with configurable strategy)

### Deployment Support

| Platform | Status |
|---|---|
| Railway | ✅ Native (config included) |
| Render | ✅ Planned (`quark deploy render`) |
| Vercel (web) + Quark Cloud (worker + infra) | ✅ Planned (`quark deploy vercel`) |
| Fly.io | ✅ Planned (`quark deploy fly`) |
| Docker (any VPS) | ✅ Planned (`quark deploy docker`) |
| AWS (ECS/Fargate) | ✅ Planned (`quark deploy aws`) |
| Quark Cloud (full stack) | ✅ Planned (`quark deploy cloud`) |

---

## Appendix B: Team & Operating Model

### Year 1–2: Solo Founder + AI System

| Role | Who | Focus |
|---|---|---|
| Founder/Lead Engineer | 1 (human) | Architecture, major features, Observe MVP, Cloud MVP |
| AI System | Automated | Client interactions, triage, small fixes, PR reviews, documentation updates |
| **Total headcount** | **1** | |

*No FTEs planned. The operating model is solo founder + AI system. AI handles client-facing interactions (issue triage, support responses, small bug fixes, documentation PRs) while the founder focuses on large features and architectural decisions. AI-raised issues feed directly into the development backlog.*

*The framework is already at V2 - the work is building Observe and Cloud, not the framework itself. Consider hiring a part-time contractor (DevRel/Content) only when MRR exceeds $5K.*

### Year 2+: Growth (contingent on revenue exceeding $5K MRR)

| Role | Count | Focus |
|---|---|---|
| Founder/Lead Engineer | 1 | Strategy + Architecture |
| AI System | Automated | Client interactions, triage, small fixes, PR reviews |
| DevRel / Content | 1 (part-time/contractor) | Docs, blog, YouTube, community |
| **Total headcount** | **1–2** | |

---

## Appendix C: Key Success Metrics

### Base Case

| Metric | Month 3 | Month 6 | Month 12 |
|---|---|---|---|
| Scaffolded projects | 30 | 150 | 500 |
| GitHub stars | 150 | 300 | 800 |
| npm weekly downloads | 50 | 150 | 400 |
| Observe connected apps | 10 | 40 | 100 |
| Observe paying workspaces | 2 | 10 | 40 |
| Cloud paying bundles | - | 5 | 30 |
| MRR | $40 | $400 | $2,500 |
| Discord members | 30 | 100 | 300 |

### Optimistic Case

| Metric | Month 3 | Month 6 | Month 12 |
|---|---|---|---|
| Scaffolded projects | 100 | 500 | 1,500 |
| GitHub stars | 500 | 1,500 | 3,000 |
| npm weekly downloads | 200 | 500 | 1,500 |
| Observe connected apps | 50 | 150 | 400 |
| Observe paying workspaces | 10 | 50 | 150 |
| Cloud paying bundles | - | 20 | 80 |
| MRR | $200 | $2,000 | $8,000 |
| Discord members | 100 | 400 | 1,000 |

---

*This document is a living strategy. Review quarterly and adjust based on actual adoption data.*

---

## Appendix D: Philosophy Alignment & Gap Analysis

### Quark's Core Philosophy

| Principle | Description |
|---|---|
| **Own your code** | Scaffolded code belongs to the developer. Full git history, full control. |
| **No lock-in** | Standard technologies (Postgres, Redis, S3, Node.js). Eject by removing one dependency. |
| **Infrastructure consistency** | Same patterns across every project. Auth, queues, validation, errors - solved once. |
| **Centralized updates** | `pnpm update @techstream/quark-core` - infrastructure improvements flow to all projects. |
| **Deploy anywhere** | Not tied to a platform. Railway, Vercel, Render, AWS, Docker, VPS - your choice. |
| **Low barrier** | Free to start. No credit card. No account. `npx` and go. |

### Does This Strategy Align?

| Decision | Philosophy Alignment | Notes |
|---|---|---|
| **Open-source everything (MIT)** | ✅ Strong | Own your code, no lock-in. |
| **Observe is self-hostable** | ✅ Strong | No forced SaaS dependency. SaaS is convenience. |
| **Quark Cloud uses standard protocols** | ✅ Strong | pg_dump, redis-cli, S3 sync - leave anytime. |
| **Admin UI + Integrations are free** | ✅ Strong | No gatekeeping. Core value drives adoption. |
| **`@techstream/quark-ai` is free** | ✅ Strong | AI features are part of the framework, not a premium tier. |
| **Quark Cloud runs compute (web + worker)** | ⚠️ Moderate | Adds operational complexity. Must ensure "deploy anywhere" remains true - Cloud is explicitly positioned as the path of least resistance, not the only path. CLI wizard shows Railway, Docker, and self-hosted as equally prominent options. |
| **Email is provider-agnostic** | ✅ Strong | SMTP, Zeptomail, Resend, or custom - adapter pattern, no vendor lock-in. |
| **Worker adapter for Vercel (serverless)** | ✅ Strong | Meets developers where they are. Doesn't force platform choice. |
| **Observe is open-source first** | ✅ Strong | Self-hostable, priced for indie devs. SaaS is convenience. Self-hosted uses same codebase. |

### What's Missing?

| Gap | Impact | Recommendation |
|---|---|---|
| **Documentation for AI patterns** | High | Teams want to see "build a chatbot in 30 minutes" docs before committing. Ship before or alongside `quark-ai`. |
| **AI compliance / agent-friendliness** | Medium | Quark's consistent structure already helps AI tools. Formalize this: publish `.cursorrules`, `.github/copilot-instructions.md`, and context files per project. Market it: "AI builds features faster on Quark because the structure is predictable." |
| **Incremental adoption guide** | High | The largest untapped audience already has Next.js apps they won't restart from scratch. "Add `quark-core` to an existing project in 20 minutes" is an additive pitch that expands the addressable market significantly. Ship in Phase 1. |
| **First-feature guide** | High | The scaffold works, but the "now what?" moment needs a task-oriented walkthrough, not architecture docs. A 20-minute guide from scaffold to working feature (CRUD + auth + email + job). Ship in Phase 1. |
| **Self-hosted Observe deployment guide** | High | If Observe is self-hostable, the docs and Docker setup must be excellent on day one. Otherwise the "no lock-in" promise rings hollow. |
| **Vercel serverless worker adapter** | High | Must ship before or alongside `quark deploy vercel`. The Vercel audience is large and expects everything to work on their platform. |
| **Status page for Quark Cloud** | Medium | If we run infrastructure for customers, they need visibility into our uptime. Build with Quark Observe (dogfooding). |
| **Billing & account management** | High | Stripe integration, usage metering, team management. Non-trivial engineering. Plan for Month 2-3. |
| **Multi-region support** | Low (Y1) | Not needed at launch, but enterprise customers will ask within 12 months. Design the architecture to support it later. |
| **CLI `update` command maturity** | Medium | The CLI scaffolds once. The `update` command (pulling infrastructure updates) needs to be robust and well-tested before marketing "centralized updates" as a feature. |
| **Community infrastructure** | Medium | Discord, GitHub Discussions, or forum. Needed before launch for early adopter support. |

### Philosophy Risks

| Risk | Assessment |
|---|---|
| **"Quark Cloud becomes the default and we accidentally create lock-in"** | Mitigate by: always showing `quark deploy railway` and `quark deploy docker` as equal options in the CLI wizard. Never make Cloud the only path. Docs should show self-hosted deployment first. |
| **"Observe SaaS becomes required because self-hosted is poorly maintained"** | Mitigate by: self-hosted Observe uses the same codebase as SaaS. If the open-source version works, the SaaS version works. Dogfood the self-hosted version internally. |
| **"AI positioning overshadows the core value"** | Mitigate by: AI is an optional feature, not the identity. Quark is "a full-stack framework" first. "AI-ready" is a differentiator, not the tagline. Teams building non-AI apps should feel equally at home. |
| **"Feature creep in Observe (errors + analytics + uptime + metrics + AI)"** | Mitigate by: phased rollout. Launch with error tracking + metrics (Month 3). Add uptime monitoring (Month 4). Add web analytics + AI metrics (Month 5). Don't ship everything at once. Each module should be independently useful. |
