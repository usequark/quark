# OpenCode MCP Setup - Techstream Asset Production Pipeline

> **This document tracks the original OpenCode MCP strategy for the Techstream asset production pipeline. The implementation has been merged into the Quark monorepo as `packages/opencode/`. See that directory for the current source of truth, and `packages/cli/` for the `--features ai` scaffolding. This document is kept as an ADR-style reference for the architectural decisions and migration path.**

**Status:** Incremental Implementation  
**Last updated:** 2026-06-26  
**Audience:** Platform engineers, DevOps, Techstream leadership

> **Architecture note:** This strategy uses unmodified upstream OpenCode - no fork. All Techstream-specific behavior is implemented via configuration, plugins, and the TypeScript SDK. The Quark monorepo (`quark`) contains the BullMQ job router, worker infrastructure, and platform services that dispatch work to the upstream OpenCode server.

---

## 1. Architecture Overview

The upstream OpenCode server runs as a standalone HTTP service on the Techstream platform. BullMQ workers dispatch jobs to it via the TypeScript SDK. Custom agents, skills, and MCP servers are configured declaratively - no source code modification to OpenCode itself.

### Deployment Modes

| Mode | Scope | Isolation | Use Case |
|---|---|---|---|
| **Central** | Internal tools, platform ops | Single instance, no client data | SEO audits, brand strategy, internal reporting |
| **Per-Project** | One instance per client project | Dedicated `.opencode/` dir, per-client API keys | Client asset production, content publishing, design review |

### Flow Diagram

```
  ┌─ Quark Monorepo ──────────────────────────────────────────┐
  │                                                            │
  │  ┌──────────────┐     ┌──────────────┐                    │
  │  │  BullMQ      │────▶│  Job Router  │                    │
  │  │  (Redis)     │     │  (HTTP)      │                    │
  │  │              │     │              │                    │
  │  │  - asset-gen │     │  Classify    │                    │
  │  │  - seo-audit │     │  Route       │                    │
  │  │  - publish   │     │  Enqueue     │                    │
  │  │  - review    │     │              │                    │
  │  └──────────────┘     └──────┬───────┘                    │
  │                              │                             │
  │  ┌───────────────────────────┴──────────────────────────┐ │
  │  │  @opencode-ai/sdk (TypeScript)                       │ │
  │  │  - createOpencodeClient(baseUrl)                     │ │
  │  │  - client.session.prompt()                           │ │
  │  │  - client.session.create()                           │ │
  │  │  - client.app.agents()                               │ │
  │  └───────────────────────────┬──────────────────────────┘ │
  │                              │ HTTP                         │
  └──────────────────────────────┼─────────────────────────────┘
                                 │
  ┌─ Upstream OpenCode ──────────┼─────────────────────────────┐
  │  (unmodified, no fork)       ▼                              │
  │                                                              │
  │  ┌──────────────────────────────────────────────┐          │
  │  │  opencode serve (port 3100)                   │          │
  │  │                                                │          │
  │  │  ┌──────────────────────────────────────────┐ │          │
  │  │  │  Global Config (~/.config/opencode/)      │ │          │
  │  │  │  ├── opencode.json           (server cfg) │ │          │
  │  │  │  ├── agents/                 (agents)     │ │          │
  │  │  │  │   ├── strategist.md                    │ │          │
  │  │  │  │   ├── producer.md                      │ │          │
  │  │  │  │   ├── reviewer.md                      │ │          │
  │  │  │  │   ├── publisher.md                     │ │          │
  │  │  │  │   └── analyst.md                       │ │          │
  │  │  │  ├── plugins/               (extensions)  │ │          │
  │  │  │  │   └── techstream.js                    │ │          │
  │  │  │  └── skills/                 (skills)     │ │          │
  │  │  │       ├── brand-voice/SKILL.md            │ │          │
  │  │  │       ├── copywriter/SKILL.md             │ │          │
  │  │  │       └── ...                             │ │          │
  │  │  └──────────────────────────────────────────┘ │          │
  │  │                                                │          │
  │  │  ┌──────────────────────────────────────────┐ │          │
  │  │  │  Per-Project Config (.opencode/ in cwd)   │ │          │
  │  │  │  ├── opencode.json      (project overrides)│ │          │
  │  │  │  ├── agents/           (per-client agents) │ │          │
  │  │  │  └── skills/           (per-client skills) │ │          │
  │  │  └──────────────────────────────────────────┘ │          │
  │  └──────────────────────┬───────────────────────┘          │
  │                         │                                   │
  └─────────────────────────┼───────────────────────────────────┘
                            │
                   ┌────────┴───────────┐
                   │  Model Gateway      │
                   │  (OpenRouter)       │
                   │                     │
                   │  ┌──────────────┐   │
                   │  │ DeepSeek V4  │   │
                   │  │ Flash / Pro  │   │
                   │  ├──────────────┤   │
                   │  │ Gemini 3.5   │   │
                   │  │ Flash        │   │
                   │  └──────────────┘   │
                   └─────────────────────┘
```

### Key Design Decisions

- **HTTP, not stdio.** The OpenCode server exposes a REST API (OpenAPI 3.1) so BullMQ workers can enqueue jobs via the TypeScript SDK without process-level coupling. The internal MCP client still uses stdio for local MCP servers.
- **Stateless workers.** Each job carries its full context. The server holds no session state between invocations.
- **OpenRouter as model gateway.** All LLM calls go through OpenRouter with per-client API keys for usage tracking and cost attribution.
- **No fork.** Zero modifications to OpenCode source. All customization is config + plugin + SDK.

---

## 2. Plugin & Configuration Strategy

Instead of forking OpenCode, we leverage its existing extensibility surface: declarative configuration, agent markdown files, skill definitions, and runtime plugins.

### What We Use from Upstream OpenCode

| Component | How We Use It |
|---|---|
| **Task classification gate** | Built-in orchestrator classifies incoming jobs. We provide custom prompts to guide classification toward asset production rather than code tasks. |
| **Agent delegation via sub-agents** | Primary agent delegates to specialist sub-agents (strategist, producer, reviewer, publisher, analyst). |
| **Parallelization logic** | Independent subtasks (e.g., generate hero image + write body copy) run concurrently via the Task tool. |
| **Review gate pattern** | Every output passes through a reviewer agent before delivery. Human-in-the-loop via permission `ask` mode for creative work; auto-approve for deterministic work. |
| **Skill loading mechanism** | Domain skills (brand-voice, seo, accessibility, copywriter) defined as `SKILL.md` files, loaded on-demand via the native `skill()` tool. |
| **MCP server integration** | MCP servers configured in `opencode.json`. No custom code needed. |

### How We Extend (No Fork Needed)

| What We Need | How OpenCode Provides It |
|---|---|
| **Custom agents** (strategist, producer, etc.) | Agent markdown files in `~/.config/opencode/agents/` - custom prompts, models, permissions |
| **Custom skills** (brand-voice, copywriter, etc.) | `SKILL.md` files in `~/.config/opencode/skills/` - loaded on-demand by the skill tool |
| **Output composition** (stitch sub-agent outputs) | Plugin hook `experimental.chat.messages.transform` - transform final output before delivery |
| **Iterative refinement** (reviewer triggers revision loops) | Plugin hook `experimental.session.compacting` - inject refinement context |
| **Custom tools** (publish-to-cms, etc.) | Plugin `tool:` definition with Zod schema |
| **Per-project isolation** | Native `.opencode/` directory support - project-overridable config, agents, skills |
| **Model routing by task type** | Per-agent `model:` config - assign different models to different agents |
| **Structured output** | SDK's `format: { type: "json_schema", schema: {...} }` - validated JSON output |

### What the Techstream Plugin Handles

The Techstream plugin (`techstream.js`) is a single file placed in `~/.config/opencode/plugins/`. It implements:

1. **Output composition hook** - listens for the orchestrator's final message and transforms it into a deliverable package (copy + metadata + image references)
2. **Refinement loop hook** - on compaction, injects context about the iteration budget and quality thresholds
3. **Custom tool registration** - `publish-to-cms`, `schedule-content`, `check-brand-compliance`
4. **Event logging** - logs job completion events to the Techstream platform for cost tracking

No code is removed, no internals are modified, nothing is patched.

### Repository Structure

The Techstream OpenCode configuration lives inside the Quark monorepo at `packages/opencode/`. This eliminates sync burden between two repos while maintaining agnosticism - `packages/opencode/` has no dependency on other Quark packages and can be used independently.

```
packages/opencode/
├── package.json              # Scoped @techstream/quark-opencode (private)
├── README.md                 # Plugin usage instructions
├── src/
│   ├── index.js              # Plugin entry - registers hooks, tools
│   ├── hooks/
│   │   ├── output-composer.js    # Stitch sub-agent outputs into deliverables
│   │   └── refinement-loop.js    # Iterative refinement with quality scoring
│   └── tools/
│       ├── publish-to-cms.js     # CMS publishing tool
│       └── check-compliance.js   # Brand compliance checker
├── config/
│   ├── opencode.json         # Techstream internal config (orchestrator + strategist, producer, reviewer, publisher, analyst)
│   └── prompts/              # Agent system prompts (Techstream internal)
│       ├── strategist.txt
│       ├── producer.txt
│       ├── reviewer.txt
│       ├── publisher.txt
│       └── analyst.txt
├── config/generic/
│   ├── opencode.json         # Per-project generic config (assistant + researcher agents)
│   └── prompts/              # Agent system prompts (generic/ per-project)
│       ├── assistant.txt
│       └── researcher.txt
├── script/
│   └── deploy.sh             # Deploy script for local OpenCode setup
├── skills/                   # SKILL.md definitions (deployed to global skills dir)
│   ├── accessibility/
│   │   └── SKILL.md
│   ├── audience-research/
│   │   └── SKILL.md
│   ├── brand-voice/
│   │   └── SKILL.md
│   ├── copywriter/
│   │   └── SKILL.md
│   ├── data-analysis/
│   │   └── SKILL.md
│   ├── distribution/
│   │   └── SKILL.md
│   ├── seo/
│   │   └── SKILL.md
│   └── skill-builder/
│       └── SKILL.md
└── deploy/                   # Template source for `quark add ai` scaffolding
    ├── Dockerfile
    ├── railway.json
    ├── config/
    │   └── ...               # Scaffolded to apps/opencode/config/ in new projects
    └── skills/
        └── ...               # Scaffolded to apps/opencode/skills/ in new projects
```

The `deploy/` directory is synced to `packages/cli/templates/opencode/` via `pnpm --filter @techstream/quark-create-app sync-templates`. When scaffolding a new project with `--features ai`, the template is copied to `apps/opencode/` and the Dockerfile COPY paths are automatically prefixed with `apps/opencode/` for Railway compatibility.

---

## 3. Model Routing (Config-Driven)

Model selection is driven by `opencode.json`, not hardcoded. Per-agent `model:` config assigns the optimal model for each agent's task type. The built-in orchestrator delegates to the appropriate agent based on job classification.

### Model Configuration in opencode.json

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": {
    "default": "openrouter/deepseek/deepseek-v4-flash"
  },
  "agent": {
    "strategist": {
      "model": "openrouter/deepseek/deepseek-v4-pro",
      "temperature": 0.3
    },
    "producer": {
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "temperature": 0.3
    },
    "reviewer": {
      "model": "openrouter/google/gemini-3.5-flash",
      "temperature": 0.4
    },
    "publisher": {
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "temperature": 0.2
    },
    "analyst": {
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "temperature": 0.1
    }
  }
}
```

### Routing Logic

Routing is handled by the primary (orchestrator) agent's system prompt and the agent permission system. The orchestrator receives an incoming job, classifies it, and delegates to the appropriate sub-agent via the Task tool. Per-agent `permission.task` rules control which sub-agents each agent can invoke.

```
Job arrives → Orchestrator inspects payload → Classifies by type →
  ├─ "blog_post"       → @producer
  ├─ "seo_audit"       → @analyst
  ├─ "brand_strategy"  → @strategist
  ├─ "design_review"   → @reviewer (Gemini for multimodal)
  └─ "content_publish" → @publisher
```

### Fallback Behavior

OpenCode's built-in provider system handles fallback. If a model is unavailable (rate limit, timeout, provider outage), the configured provider fallback chain is used. This is configured in `opencode.json`:

```jsonc
{
  "provider": {
    "openrouter": {
      "models": {
        "deepseek/deepseek-v4-flash": {
          "fallbacks": ["deepseek/deepseek-v4-pro", "google/gemini-3.5-flash"]
        }
      }
    }
  }
}
```

If all models fail, the BullMQ job is re-queued with exponential backoff.

---

## 4. MCP Server Setup

> **Deferred:** MCP server implementation is deferred until after the core OpenCode server is built and proven with internal task management (Phase 0). The MCP integrations described below are the target architecture - they will be implemented incrementally once the server is stable and handling internal workflows reliably.

MCP servers are configured in `opencode.json` - no custom code needed. OpenCode's native MCP client handles connection lifecycle.

### Core MCPs (Build First)

#### `playwright-mcp`
- **Purpose:** Browser automation - screenshot capture, page testing, visual regression
- **Used by:** `reviewer`, `producer`
- **Key tools:**
  - `browser_navigate` - open a URL
  - `browser_screenshot` - capture viewport or full page
  - `browser_click`, `browser_fill` - interact with pages
  - `browser_evaluate` - run JS in page context
- **Transport:** stdio

#### `github-mcp`
- **Purpose:** Repository operations - content versioning, PR-based review workflows
- **Used by:** `publisher`, `reviewer`
- **Key tools:**
  - `create_or_update_file` - commit content to repo
  - `create_pull_request` - open a review PR
  - `search_repositories`, `get_file_contents` - read existing content
  - `create_branch` - isolate changes per task
- **Transport:** HTTP (GitHub API)

#### `postgres-mcp`
- **Purpose:** Direct database access - query client data, content history, analytics
- **Used by:** `analyst`, `strategist`, `publisher`
- **Key tools:**
  - `query` - run read-only SQL
  - `list_tables`, `describe_table` - schema introspection
- **Transport:** stdio (local `psql` connection string)
- **Security:** Read-only connection string; write operations go through the app API, not MCP.

#### `cms-mcp`
- **Purpose:** Content publishing - create, update, schedule content in the CMS
- **Used by:** `publisher`
- **Key tools:**
  - `create_post` - publish a new article/page
  - `update_post` - revise existing content
  - `schedule_post` - set future publish date
  - `list_posts`, `get_post` - read existing content
  - `upload_media` - upload images/assets
- **Transport:** HTTP (CMS REST API)

#### `analytics-mcp`
- **Purpose:** Performance data - GA4 and Umami metrics for reporting and optimization
- **Used by:** `analyst`, `strategist`
- **Key tools:**
  - `get_page_metrics` - pageviews, bounce rate, session duration
  - `get_conversion_data` - goal completions, funnel analysis
  - `get_realtime` - current active users
  - `run_report` - custom GA4/Umami report
- **Transport:** HTTP (GA4 Data API / Umami API)

#### `email-mcp`
- **Purpose:** Client communication - send reports, deliverables, notifications
- **Used by:** `publisher`, `orchestrator`
- **Key tools:**
  - `send_email` - send transactional email
  - `send_report` - attach and send a formatted report
  - `get_templates` - list available email templates
- **Transport:** HTTP (Resend / SendGrid API)

### Expansion MCPs (Phase 3)

| MCP | Purpose | Used By | Key Tools |
|---|---|---|---|
| `image-gen-mcp` | AI image generation via DALL-E / Midjourney / Stable Diffusion | `producer` | `generate_image`, `upscale_image`, `remove_background` |
| `video-gen-mcp` | AI video generation via Runway / Pika | `producer` | `generate_clip`, `extend_clip`, `text_to_video` |
| `canva-mcp` | Template-based design automation | `producer` | `create_design`, `apply_template`, `export_design` |
| `stripe-mcp` | Billing and subscription management | `orchestrator` | `get_subscription`, `create_invoice`, `get_usage` |

### MCP Configuration in opencode.json

```jsonc
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-playwright"],
      "transport": "stdio"
    },
    "github": {
      "url": "https://api.github.com",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-postgres", "${DATABASE_URL_READONLY}"],
      "transport": "stdio"
    },
    "cms": {
      "url": "${CMS_API_URL}",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer ${CMS_API_KEY}"
      }
    },
    "analytics": {
      "url": "https://analytics.googleapis.com",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer ${GA4_SERVICE_ACCOUNT_TOKEN}"
      }
    },
    "email": {
      "url": "https://api.resend.com",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer ${RESEND_API_KEY}"
      }
    }
  }
}
```

---

## 5. Per-Project Deployment

Each client project gets a dedicated `.opencode/` directory at the project root. OpenCode natively discovers and loads these - no custom code needed.

### Directory Structure

```
client-projects/
└── acme-corp/
    ├── .opencode/
    │   ├── opencode.json          # Project-specific config (model routing, MCPs)
    │   ├── agents/
    │   │   ├── strategist.md      # Custom brand strategy agent
    │   │   ├── producer.md        # Asset production agent
    │   │   ├── reviewer.md        # Quality review agent
    │   │   └── publisher.md       # Publishing agent
    │   └── skills/
    │       ├── brand-voice/
    │       │   └── SKILL.md       # Client-specific tone, vocabulary, style guide
    │       ├── seo/
    │       │   └── SKILL.md       # SEO rules and keyword strategy
    │       └── compliance/
    │           └── SKILL.md       # Industry-specific compliance checks
    ├── content/
    ├── assets/
    └── published/
```

OpenCode loads configs hierarchically: global (`~/.config/opencode/`) first, then project (`.opencode/`). Project values override global values. This means global agents/skills provide defaults, and each project can override only what it needs.

### Per-Client API Keys

Each project uses its own provider API keys via environment variables. When the BullMQ job router creates a session for a specific project, it sets the working directory to that project's root. OpenCode reads `.opencode/opencode.json` which references environment-specific variables:

```jsonc
{
  "provider": {
    "openrouter": {
      "apiKey": "${ACMECORP_OPENROUTER_KEY}"
    }
  }
}
```

### Central Cost Tracking

The BullMQ job router tracks costs centrally. When a job completes, the router records token usage and cost against the project's monthly budget. A separate dashboard aggregates usage across all projects:

```
┌─────────────────────────────────────────────────────────┐
│  Techstream Cost Dashboard                              │
├──────────────┬──────────┬──────────┬──────────┬─────────┤
│ Project      │ Today    │ This Week│ This Month│ Limit  │
├──────────────┼──────────┼──────────┼──────────┼─────────┤
│ acme-corp    │ $12.40   │ $87.30   │ $342.10  │ $500   │
│ globex       │ $8.75    │ $52.10   │ $198.40  │ $300   │
│ initech      │ $23.10   │ $145.80  │ $478.20  │ $500   │
│ umbra-co     │ $4.20    │ $31.50   │ $112.30  │ $200   │
├──────────────┼──────────┼──────────┼──────────┼─────────┤
│ TOTAL        │ $48.45   │ $316.70  │ $1,131.00│ $1,500  │
└─────────────────────────────────────────────────────────┘
```

### Budget Alerts

Defined in the Techstream platform (Quark monorepo), not in OpenCode config:

```jsonc
{
  "budget": {
    "alerts": [
      { "threshold": 0.50, "channel": "email", "recipient": "pm@techstream.io" },
      { "threshold": 0.75, "channel": "slack", "recipient": "#ops-alerts" },
      { "threshold": 0.90, "channel": "email+sms", "recipient": "cto@techstream.io" },
      { "threshold": 1.00, "action": "suspend_project", "reason": "Monthly limit reached" }
    ]
  }
}
```

Thresholds are percentages of the monthly limit. At 50%, the PM gets an email. At 75%, Slack is notified. At 90%, the CTO gets paged. At 100%, the project is suspended until the limit is raised or the month rolls over. The router checks these before dispatching jobs.

---

## 6. Deployment

### Server Deployment

The upstream OpenCode binary is deployed as a headless server using Docker.

#### Option A: Docker (Recommended)

Use the official Docker image published by the OpenCode team:

```bash
docker run -d \
  --name opencode-server \
  -p 3100:4096 \
  -v ~/.config/opencode:/home/user/.config/opencode \
  -v /path/to/projects:/projects \
  -e OPENCODE_SERVER_PASSWORD="${SERVER_PASSWORD}" \
  ghcr.io/anomalyco/opencode \
  opencode serve --port 4096 --hostname 0.0.0.0
```

#### Option B: Binary

Install the binary and run directly:

```bash
npm install -g opencode-ai@latest
opencode serve --port 3100 --hostname 0.0.0.0
```

### Config Initialization

In the Quark monorepo, config, skills, and the plugin are managed directly in `packages/opencode/`. Deploy to the global OpenCode config directory:

```bash
# From the Quark monorepo root
cp -r packages/opencode/config/* ~/.config/opencode/
cp -r packages/opencode/skills/* ~/.config/opencode/skills/
cp packages/opencode/src/index.js ~/.config/opencode/plugins/techstream.js
cd ~/.config/opencode && bun add @opencode-ai/plugin
```

For scaffolded projects, the `--features ai` flag (or `quark add ai`) handles this automatically:
- Creates `apps/opencode/` with Dockerfile, railway.json, config, and skills
- Adds `@opencode-ai/sdk` to the worker's dependencies
- The BullMQ worker auto-discovers the OpenCode service via Railway internal networking (`http://opencode:4096`)

### Job Router (Quark Monorepo)

The BullMQ job router in the Quark monorepo dispatches jobs using the TypeScript SDK:

```javascript
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({
  baseUrl: process.env.OPENCODE_SERVER_URL,
})

export async function dispatchAssetGenJob(project, brief) {
  // Create a session in the project's directory
  const session = await client.session.create({
    body: {
      title: `Asset: ${brief.type} - ${brief.topic}`,
    },
    headers: {
      "x-opencode-directory": encodeURIComponent(project.directory),
    },
  })

  // Send the prompt with structured output
  const result = await client.session.prompt({
    path: { id: session.id },
    body: {
      agent: "producer",
      parts: [{ type: "text", text: brief.instructions }],
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            draft: { type: "string" },
            metadata: { type: "object" },
          },
          required: ["draft", "metadata"],
        },
      },
    },
  })

  return result.data
}
```

---

## 7. Global Configuration (opencode.json)

The main OpenCode config file lives at `~/.config/opencode/opencode.json`. This is the single source of truth for the Techstream OpenCode server.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  // ── Default Model ───────────────────────────────────
  "model": {
    "default": "openrouter/deepseek/deepseek-v4-flash"
  },

  // ── Providers ───────────────────────────────────────
  "provider": {
    "openrouter": {
      "apiKey": "${OPENROUTER_API_KEY}"
    }
  },

  // ── Agent Definitions ───────────────────────────────
  "agent": {
    "build": { "disable": true },
    "plan": { "disable": true },
    "orchestrator": {
      "mode": "primary",
      "description": "Orchestrator - classifies incoming jobs and delegates to specialist sub-agents. Composes final outputs.",
      "model": "openrouter/deepseek/deepseek-v4-pro",
      "temperature": 0.3,
      "permission": {
        "task": {
          "*": "allow"
        }
      }
    },
    "strategist": {
      "mode": "subagent",
      "description": "Brand strategy, content planning, audience analysis",
      "model": "openrouter/deepseek/deepseek-v4-pro",
      "temperature": 0.3,
      "permission": {
        "read": "allow",
        "bash": "deny",
        "edit": "deny"
      },
      "prompt": "{file:./prompts/strategist.txt}"
    },
    "producer": {
      "mode": "subagent",
      "description": "Asset generation - copy, images, layouts",
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "temperature": 0.3,
      "permission": {
        "read": "allow",
        "edit": "allow",
        "bash": "deny"
      },
      "prompt": "{file:./prompts/producer.txt}"
    },
    "reviewer": {
      "mode": "subagent",
      "description": "Quality gate - brand consistency, SEO, accessibility, visual QA",
      "model": "openrouter/google/gemini-3.5-flash",
      "temperature": 0.4,
      "permission": {
        "read": "allow",
        "bash": "deny",
        "edit": "deny"
      },
      "prompt": "{file:./prompts/reviewer.txt}"
    },
    "publisher": {
      "mode": "subagent",
      "description": "CMS publishing, scheduling, distribution",
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "temperature": 0.2,
      "permission": {
        "read": "allow",
        "edit": "allow",
        "bash": "ask"
      },
      "prompt": "{file:./prompts/publisher.txt}"
    },
    "analyst": {
      "mode": "subagent",
      "description": "Performance data, SEO audits, conversion metrics",
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "temperature": 0.1,
      "permission": {
        "read": "allow",
        "bash": "deny",
        "edit": "deny"
      },
      "prompt": "{file:./prompts/analyst.txt}"
    }
  },

  // ── MCP Servers ─────────────────────────────────────
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-playwright"],
      "transport": "stdio"
    },
    "github": {
      "url": "https://api.github.com",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-postgres", "${DATABASE_URL_READONLY}"],
      "transport": "stdio"
    },
    "cms": {
      "url": "${CMS_API_URL}",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer ${CMS_API_KEY}"
      }
    },
    "analytics": {
      "url": "https://analytics.googleapis.com",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer ${GA4_SERVICE_ACCOUNT_TOKEN}"
      }
    },
    "email": {
      "url": "https://api.resend.com",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer ${RESEND_API_KEY}"
      }
    }
  },

  // ── Global Permissions ──────────────────────────────
  "permission": {
    "edit": "ask",
    "bash": "ask",
    "skill": {
      "internal-*": "deny"
    }
  }
}
```

---

## 8. Implementation Phases

### Phase 0 - Foundation & Internal Dogfooding (Weeks 1–2)

**Phase 0 complete.** All Phase 0 tasks below have been delivered. The plugin repo was created, then migrated into the Quark monorepo as `packages/opencode/`. The BullMQ job router, CLI scaffolding (`--features ai`, `quark add ai`), and Railway auto-discovery are all operational. See `packages/opencode/` for the current source of truth.

**Goal:** Deploy upstream OpenCode, configure Techstream agents and skills, prove the pipeline works with internal tasks.

| Task | Deliverable |
|---|---|
| Install OpenCode globally (`npm install -g opencode-ai`) | Ready to use |
| Create Techstream plugin repo with config, agents, skills, plugin code | `packages/opencode/` in Quark monorepo |
| Deploy OpenCode server via Docker | Running `opencode serve` on Techstream infra |
| Create agent markdown files (strategist, producer, reviewer, publisher, analyst) | 5 agent files in global config |
| Create skill SKILL.md files (brand-voice, copywriter, seo, accessibility, audience-research, data-analysis, distribution) | 7 skill dirs in global config |
| Write system prompts for each agent | 5 prompt files in global config |
| Build Techstream plugin (output composition hook, custom tools) | `techstream.js` plugin |
| Build BullMQ job router with SDK integration | Worker dispatches jobs via `@opencode-ai/sdk`; CLI scaffolding (`--features ai`, `quark add ai`) operational |
| Build task population workflow | Strategist agent breaks down project milestones into tasks |
| Build status tracking workflow | Orchestrator monitors progress, updates statuses, flags blockers |
| Build daily standup report | Analyst generates daily summary via session prompt |

### Phase 1 - Single Production Flow (Weeks 3–4)

**Goal:** One MCP, one end-to-end client job.

| Task | Deliverable |
|---|---|
| Configure providers (OpenRouter) in opencode.json | All LLM calls routed through OpenRouter |
| Wire up playwright-mcp | Reviewer agent can take screenshots and analyze pages |
| End-to-end smoke test | "Generate a blog post about X" → classification → producer → reviewer → output via HTTP API |
| Structured output support | SDK `json_schema` format for validated output |
| Cost tracking (usage logging via plugin) | Token usage logged per session for billing |

### Phase 2 - Core MCPs & Per-Project (Weeks 5–6)

**Goal:** All core MCPs operational, per-project isolation working.

| Task | Deliverable |
|---|---|
| Integrate github-mcp | Content versioned in repos, PR-based review workflow |
| Integrate postgres-mcp | Analyst agent queries client data for reporting |
| Integrate cms-mcp | Publisher agent pushes content to CMS |
| Integrate analytics-mcp | Analyst agent pulls GA4/Umami data for reports |
| Integrate email-mcp | Orchestrator sends completed deliverables to clients |
| Per-project `.opencode/` structure deployed for first client | Client project has isolated config, agents, skills |
| Per-client API keys via environment variables | Cost tracking per project, budget enforcement |
| Central cost dashboard (MVP) | Daily/weekly/monthly spend per project, alert thresholds |

### Phase 3 - Expansion & Polish (Weeks 7–8)

**Goal:** Creative MCPs, full cost dashboard, production hardening.

| Task | Deliverable |
|---|---|
| Integrate image-gen-mcp | Producer generates hero images, social graphics |
| Integrate video-gen-mcp | Producer generates short-form video clips |
| Integrate canva-mcp | Producer creates template-based designs |
| Integrate stripe-mcp | Billing integration, usage-based invoicing |
| Full cost dashboard with charts and exports | Historical usage, per-model breakdown, CSV export |
| Iterative refinement loop via plugin hook | Reviewer triggers `refine()` up to 3 iterations, auto-approve above 0.9 score |
| Load testing and concurrency tuning | 20 concurrent jobs across 4 projects, <2s p95 latency for classification |
| Plugin hardening and error handling | Graceful degradation if plugin hooks fail |
| Documentation and runbooks | Operator guide, client onboarding guide, incident response runbook |

---

## Appendix A: Migration Path (from old fork plan)

If the fork approach was already started (e.g., an `opencode-techstream` repo exists), here's the migration path:

1. **Archive** the `opencode-techstream` repo - do not delete, but mark as superseded
2. **Install** upstream OpenCode via npm/Docker
3. **Extract** custom agents, skills, and prompts from the fork - these move to config files and markdown definitions
4. **Extract** custom logic from the fork - this becomes the Techstream plugin
5. **Deploy** the upstream server with the new config and plugin
6. **Delete** the fork - it is no longer needed

The migration is low-risk because the fork's customizations (agents, skills, routing) were already at the config/definition level in the original plan. No core logic was modified that cannot be expressed through upstream extension points.
