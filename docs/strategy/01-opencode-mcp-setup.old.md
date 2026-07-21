# OpenCode MCP Setup - Techstream Asset Production Pipeline

**Status:** Implementation-ready  
**Last updated:** 2026-06-24  
**Audience:** Platform engineers, DevOps, Techstream leadership

> **Repo note:** The OpenCode fork lives in its own separate repository - `opencode-techstream` - not inside the Quark monorepo. The Quark monorepo (`quark`) contains the BullMQ job router, worker infrastructure, and platform services that dispatch work to the fork. The fork repo is the standalone HTTP server hosting agents, skills, and the MCP client.

---

## 1. Architecture Overview

The forked OpenCode server runs as a standalone HTTP service on the Techstream platform. BullMQ workers dispatch jobs to it; the server hosts agents, skills, and an MCP client that connects to external tools. Two deployment modes isolate internal tooling from client workloads.

### Deployment Modes

| Mode | Scope | Isolation | Use Case |
|---|---|---|---|
| **Central** | Internal tools, platform ops | Shared instance, no client data | SEO audits, brand strategy, internal reporting |
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
  └──────────────────────────────┼─────────────────────────────┘
                                 │ HTTP
                                 │
  ┌─ opencode-techstream Repo ───┼─────────────────────────────┐
  │                              ▼                              │
  │  ┌──────────────────────────────────────────────┐          │
  │  │  OpenCode Server (Fork)                      │          │
  │  │                                              │          │
  │  │  ┌──────────────┐                            │          │
  │  │  │ Orchestrator │                            │          │
  │  │  └──────┬───────┘                            │          │
  │  │         │                                     │          │
  │  │  ┌──────┴───────┐                            │          │
  │  │  │ Sub-Agents   │                            │          │
  │  │  │ - strategist │                            │          │
  │  │  │ - producer   │                            │          │
  │  │  │ - reviewer   │                            │          │
  │  │  │ - publisher  │                            │          │
  │  │  └──────┬───────┘                            │          │
  │  │         │                                     │          │
  │  │  ┌──────┴───────┐                            │          │
  │  │  │ MCP Client   │                            │          │
  │  │  │ (stdio/HTTP) │                            │          │
  │  │  └──────────────┘                            │          │
  │  └──────────────────────┬───────────────────────┘          │
  │                         │                                   │
  └─────────────────────────┼───────────────────────────────────┘
                            │
                   ┌────────┴───────────┐
                   │  Model Gateway     │
                   │  (OpenRouter)      │
                   │                    │
                   │  ┌──────────────┐  │
                   │  │ DeepSeek V4  │  │
                   │  │ Flash / Pro  │  │
                   │  ├──────────────┤  │
                   │  │ Gemini 3.5   │  │
                   │  │ Flash        │  │
                   │  └──────────────┘  │
                   └────────────────────┘
```

### Key Design Decisions

- **HTTP, not stdio.** The OpenCode server exposes a REST API so BullMQ workers can enqueue jobs without process-level coupling. The internal MCP client still uses stdio for local MCP servers.
- **Stateless workers.** Each job carries its full context. The server holds no session state between invocations.
- **OpenRouter as model gateway.** All LLM calls go through OpenRouter with per-client API keys for usage tracking and cost attribution.

---

## 2. Server Fork Design

### What to Keep from Current OpenCode

| Component | Reason |
|---|---|
| **Task classification gate** | Jobs arrive untyped; the orchestrator inspects the payload and classifies into asset-gen, review, publish, audit, etc. |
| **Agent delegation via sub-agents** | The orchestrator spawns specialist agents (strategist, producer, reviewer, publisher) for each subtask. |
| **Parallelization logic** | Independent subtasks (e.g., generate hero image + write body copy) run concurrently. |
| **Review gate pattern** | Every output passes through a reviewer agent before delivery. Creative work gets human-in-the-loop; deterministic work is auto-approved. |
| **Skill loading mechanism** | Domain skills (brand-voice, seo, accessibility, copywriter) load on demand, same as current `skill()` tool. |

### What to Adapt

| Change | Rationale |
|---|---|
| **Domain routing for asset production** | Classification criteria shift from "is this a bug or feature?" to "is this a blog post, landing page, email campaign, or social asset?" |
| **Orchestrator can compose outputs** | The current orchestrator is read-only. The forked orchestrator assembles final deliverables (stitching copy + images + metadata into a publishable unit). |
| **Iterative refinement pattern** | Creative tasks need revision loops. Add a `refine(draft, feedback)` step that the reviewer can trigger before final output. |

### What to Remove

- **Code-specific agents:** `developer`, `tester`, `devops`, `migrator`, `security` - not relevant to asset production.
- **Code-specific classification criteria:** Bug reports, PR reviews, test generation, deployment checks.
- **File-system tool restrictions:** The forked server needs broader filesystem access for asset staging, not just code editing.

### New Agents (Replacing Removed Ones)

| Agent | Role | Replaces |
|---|---|---|
| `strategist` | Brand strategy, content planning, audience analysis | `architect` (adapted) |
| `producer` | Asset generation - copy, images, layouts | `developer` (repurposed) |
| `reviewer` | Quality gate - brand consistency, SEO, accessibility | `reviewer` (adapted) |
| `publisher` | CMS publishing, scheduling, distribution | `devops` (repurposed) |
| `analyst` | Performance data, SEO audits, conversion metrics | `analytics` (adapted) |

---

## 3. Model Routing (Config-Driven)

Model selection is driven by `config.json`, not hardcoded. The router inspects the task type and picks the cheapest model that meets the quality bar.

### Model Registry

```jsonc
{
  "models": {
    "deepseek-v4-flash": {
      "provider": "openrouter",
      "modelId": "deepseek/deepseek-v4-flash",
      "costPer1kInput": 0.0001,
      "costPer1kOutput": 0.0004,
      "strengths": ["bulk_text", "drafting", "seo_audit", "reports", "summarization"],
      "maxTokens": 128000,
      "defaultTemperature": 0.3
    },
    "deepseek-v4-pro": {
      "provider": "openrouter",
      "modelId": "deepseek/deepseek-v4-pro",
      "costPer1kInput": 0.001,
      "costPer1kOutput": 0.004,
      "strengths": ["planning", "brand_strategy", "architecture", "complex_reasoning"],
      "maxTokens": 128000,
      "defaultTemperature": 0.3
    },
    "gemini-3.5-flash": {
      "provider": "openrouter",
      "modelId": "google/gemini-3.5-flash",
      "costPer1kInput": 0.000075,
      "costPer1kOutput": 0.0003,
      "strengths": ["visual_review", "screenshot_analysis", "design_feedback", "multimodal"],
      "maxTokens": 1000000,
      "defaultTemperature": 0.4
    }
  }
}
```

### Routing Rules

```jsonc
{
  "routing": {
    "rules": [
      {
        "taskTypes": ["blog_post", "email_campaign", "social_caption", "meta_description", "alt_text"],
        "model": "deepseek-v4-flash",
        "reason": "Bulk text generation, low cost, high throughput"
      },
      {
        "taskTypes": ["seo_audit", "content_report", "analytics_summary", "competitor_analysis"],
        "model": "deepseek-v4-flash",
        "reason": "Long-form structured output, no visual reasoning needed"
      },
      {
        "taskTypes": ["brand_strategy", "content_calendar", "campaign_planning", "audience_persona"],
        "model": "deepseek-v4-pro",
        "reason": "Complex reasoning, multi-step planning, strategic decisions"
      },
      {
        "taskTypes": ["design_review", "screenshot_audit", "landing_page_review", "visual_qa"],
        "model": "gemini-3.5-flash",
        "reason": "Multimodal input required, visual analysis"
      },
      {
        "taskTypes": ["landing_page_copy", "sales_page", "brand_guidelines"],
        "model": "deepseek-v4-pro",
        "reason": "High-stakes copy where quality trumps cost"
      }
    ],
    "fallbackChain": ["deepseek-v4-flash", "deepseek-v4-pro", "gemini-3.5-flash"],
    "fallbackStrategy": "next_available"
  }
}
```

### Fallback Behavior

When the primary model fails (rate limit, timeout, provider outage), the router walks the `fallbackChain` in order. If the fallback model lacks the required capability (e.g., Gemini gets a non-visual task), it skips to the next entry. If all models fail, the job is re-queued with exponential backoff.

---

## 4. MCP Server Setup

> **Deferred:** MCP server implementation is deferred until after the core OpenCode fork is built and proven with internal task management (Phase 0). The MCP integrations described below are the target architecture - they will be implemented incrementally once the fork is stable and handling internal workflows reliably.

### Core MCPs (Build First)

#### `playwright-mcp`
- **Purpose:** Browser automation - screenshot capture, page testing, visual regression
- **Used by:** `reviewer`, `producer`
- **Key tools:**
  - `browser_navigate` - open a URL
  - `browser_screenshot` - capture viewport or full page
  - `browser_click`, `browser_fill` - interact with pages
  - `browser_evaluate` - run JS in page context
- **Transport:** stdio (local), HTTP (remote)

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
| `openrouter-mcp` | Direct model access for custom prompts | `strategist`, `producer` | `chat_completion`, `list_models`, `get_pricing` |
| `stripe-mcp` | Billing and subscription management | `orchestrator` | `get_subscription`, `create_invoice`, `get_usage` |

### MCP Configuration in config.json

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

Each client project gets a dedicated `.opencode/` directory at the project root. This isolates configuration, agent definitions, skills, and API keys per client.

### Directory Structure

```
client-projects/
└── acme-corp/
    ├── .opencode/
    │   ├── config.json          # Project-specific config (model routing, MCPs, budget)
    │   ├── agents/
    │   │   ├── strategist.js    # Custom brand strategy agent
    │   │   ├── producer.js      # Asset production agent
    │   │   ├── reviewer.js      # Quality review agent
    │   │   └── publisher.js     # Publishing agent
    │   └── skills/
    │       ├── brand-voice.js   # Client-specific tone, vocabulary, style guide
    │       ├── seo.js           # SEO rules and keyword strategy
    │       └── compliance.js    # Industry-specific compliance checks
    ├── content/
    ├── assets/
    └── published/
```

### Per-Client API Keys

Each project gets its own OpenRouter API key with usage limits:

```jsonc
{
  "project": {
    "id": "proj_acme_corp_001",
    "name": "Acme Corp",
    "openrouter": {
      "apiKey": "${ACME_OPENROUTER_KEY}",
      "usageLimit": {
        "daily": 50.00,      // USD
        "monthly": 500.00    // USD
      }
    }
  }
}
```

### Central Cost Tracking

A central dashboard aggregates usage across all projects:

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
└──────────────┴──────────┴──────────┴──────────┴─────────┘
```

### Budget Alerts

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

Thresholds are percentages of the monthly limit. At 50%, the PM gets an email. At 75%, Slack is notified. At 90%, the CTO gets paged. At 100%, the project is suspended until the limit is raised or the month rolls over.

---

## 6. config.json Full Structure

```jsonc
{
  // ── Server Identity ──────────────────────────────────
  "server": {
    "name": "techstream-opencode",
    "version": "1.0.0",
    "mode": "per_project",             // "central" | "per_project"
    "port": 3100,
    "logLevel": "info"                 // "debug" | "info" | "warn" | "error"
  },

  // ── Project Binding (per_project mode only) ──────────
  "project": {
    "id": "proj_acme_corp_001",
    "name": "Acme Corp",
    "openrouter": {
      "apiKey": "${ACME_OPENROUTER_KEY}",
      "usageLimit": {
        "daily": 50.00,
        "monthly": 500.00
      }
    }
  },

  // ── Model Registry ───────────────────────────────────
  "models": {
    "deepseek-v4-flash": {
      "provider": "openrouter",
      "modelId": "deepseek/deepseek-v4-flash",
      "costPer1kInput": 0.0001,
      "costPer1kOutput": 0.0004,
      "strengths": ["bulk_text", "drafting", "seo_audit", "reports", "summarization"],
      "maxTokens": 128000,
      "defaultTemperature": 0.3
    },
    "deepseek-v4-pro": {
      "provider": "openrouter",
      "modelId": "deepseek/deepseek-v4-pro",
      "costPer1kInput": 0.001,
      "costPer1kOutput": 0.004,
      "strengths": ["planning", "brand_strategy", "architecture", "complex_reasoning"],
      "maxTokens": 128000,
      "defaultTemperature": 0.3
    },
    "gemini-3.5-flash": {
      "provider": "openrouter",
      "modelId": "google/gemini-3.5-flash",
      "costPer1kInput": 0.000075,
      "costPer1kOutput": 0.0003,
      "strengths": ["visual_review", "screenshot_analysis", "design_feedback", "multimodal"],
      "maxTokens": 1000000,
      "defaultTemperature": 0.4
    }
  },

  // ── Model Routing ────────────────────────────────────
  "routing": {
    "rules": [
      {
        "taskTypes": ["blog_post", "email_campaign", "social_caption", "meta_description", "alt_text"],
        "model": "deepseek-v4-flash",
        "reason": "Bulk text generation, low cost, high throughput"
      },
      {
        "taskTypes": ["seo_audit", "content_report", "analytics_summary", "competitor_analysis"],
        "model": "deepseek-v4-flash",
        "reason": "Long-form structured output, no visual reasoning needed"
      },
      {
        "taskTypes": ["brand_strategy", "content_calendar", "campaign_planning", "audience_persona"],
        "model": "deepseek-v4-pro",
        "reason": "Complex reasoning, multi-step planning, strategic decisions"
      },
      {
        "taskTypes": ["design_review", "screenshot_audit", "landing_page_review", "visual_qa"],
        "model": "gemini-3.5-flash",
        "reason": "Multimodal input required, visual analysis"
      },
      {
        "taskTypes": ["landing_page_copy", "sales_page", "brand_guidelines"],
        "model": "deepseek-v4-pro",
        "reason": "High-stakes copy where quality trumps cost"
      }
    ],
    "fallbackChain": ["deepseek-v4-flash", "deepseek-v4-pro", "gemini-3.5-flash"],
    "fallbackStrategy": "next_available"
  },

  // ── MCP Servers ──────────────────────────────────────
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

  // ── Agent Definitions ────────────────────────────────
  "agents": {
    "orchestrator": {
      "description": "Classifies incoming jobs and delegates to sub-agents. Composes final outputs.",
      "model": "deepseek-v4-pro",
      "skills": ["task-classification", "output-composition"]
    },
    "strategist": {
      "description": "Brand strategy, content planning, audience analysis",
      "model": "deepseek-v4-pro",
      "skills": ["brand-voice", "seo", "audience-research"],
      "mcpServers": ["postgres", "analytics"]
    },
    "producer": {
      "description": "Asset generation - copy, images, layouts",
      "model": "deepseek-v4-flash",
      "skills": ["brand-voice", "copywriter", "seo"],
      "mcpServers": ["playwright", "github"]
    },
    "reviewer": {
      "description": "Quality gate - brand consistency, SEO, accessibility, visual QA",
      "model": "gemini-3.5-flash",
      "skills": ["brand-voice", "seo", "accessibility"],
      "mcpServers": ["playwright", "github"]
    },
    "publisher": {
      "description": "CMS publishing, scheduling, distribution",
      "model": "deepseek-v4-flash",
      "skills": ["scheduling", "distribution"],
      "mcpServers": ["cms", "github", "email"]
    },
    "analyst": {
      "description": "Performance data, SEO audits, conversion metrics",
      "model": "deepseek-v4-flash",
      "skills": ["seo", "data-analysis"],
      "mcpServers": ["postgres", "analytics"]
    }
  },

  // ── Skills ───────────────────────────────────────────
  "skills": {
    "brand-voice": {
      "path": "./skills/brand-voice.js",
      "description": "Client-specific tone, vocabulary, and style guide enforcement"
    },
    "seo": {
      "path": "./skills/seo.js",
      "description": "SEO best practices, keyword strategy, metadata optimization"
    },
    "copywriter": {
      "path": "./skills/copywriter.js",
      "description": "Persuasive copywriting patterns for landing pages, emails, ads"
    },
    "accessibility": {
      "path": "./skills/accessibility.js",
      "description": "WCAG 2.2 compliance, ARIA patterns, inclusive design review"
    },
    "audience-research": {
      "path": "./skills/audience-research.js",
      "description": "Audience persona development, demographic analysis"
    },
    "task-classification": {
      "path": "./skills/task-classification.js",
      "description": "Classify incoming jobs into task types for routing"
    },
    "output-composition": {
      "path": "./skills/output-composition.js",
      "description": "Assemble sub-agent outputs into final deliverable packages"
    },
    "scheduling": {
      "path": "./skills/scheduling.js",
      "description": "Content calendar management, optimal publish timing"
    },
    "distribution": {
      "path": "./skills/distribution.js",
      "description": "Multi-channel distribution - email, social, RSS"
    },
    "data-analysis": {
      "path": "./skills/data-analysis.js",
      "description": "Analytics interpretation, trend detection, reporting"
    }
  },

  // ── Budget & Alerts ──────────────────────────────────
  "budget": {
    "alerts": [
      { "threshold": 0.50, "channel": "email", "recipient": "pm@techstream.io" },
      { "threshold": 0.75, "channel": "slack", "recipient": "#ops-alerts" },
      { "threshold": 0.90, "channel": "email+sms", "recipient": "cto@techstream.io" },
      { "threshold": 1.00, "action": "suspend_project", "reason": "Monthly limit reached" }
    ]
  },

  // ── Job Queue ────────────────────────────────────────
  "queue": {
    "redis": {
      "host": "${REDIS_HOST}",
      "port": 6379
    },
    "concurrency": {
      "perProject": 5,
      "global": 20
    },
    "retry": {
      "maxAttempts": 3,
      "backoff": {
        "type": "exponential",
        "delay": 1000
      }
    }
  },

  // ── Refinement Loop ──────────────────────────────────
  "refinement": {
    "maxIterations": 3,
    "autoApproveIf": {
      "reviewScore": 0.9,
      "changePercent": 0.05
    }
  }
}
```

---

## 7. Implementation Phases

### Phase 0 - Internal Task Management (Weeks 1–2)

**Goal:** Prove the fork works by automating Techstream's own internal task management before building client-facing features.

| Task | Deliverable |
|---|---|
| Fork OpenCode into `opencode-techstream` repo, strip code-specific agents | Running HTTP server with orchestrator + strategist + producer + reviewer + publisher agents |
| Integrate with Techstream's Kanban board (Linear/Notion) | Agents can read, create, and update tasks via API |
| Build task population workflow | Strategist agent breaks down project milestones into individual tasks and populates the board |
| Build status tracking workflow | Orchestrator monitors task progress, updates statuses, flags blockers |
| Build daily standup report | Analyst agent generates a daily summary of task progress, blockers, and upcoming deadlines |
| Internal dogfooding | Techstream team uses the fork for 1–2 weeks of real task management, iterating on reliability |

### Phase 1 - Foundation (Weeks 3–4)

**Goal:** One model, one MCP, one end-to-end client job.

| Task | Deliverable |
|---|---|
| Implement model router with config-driven rules | `routing.js` module that reads `config.json` and selects model per task type |
| Integrate OpenRouter as model gateway | All LLM calls go through OpenRouter with API key from config |
| Wire up one MCP server (playwright-mcp) | Reviewer agent can take screenshots and analyze pages |
| Build BullMQ job router | Worker accepts `asset-gen` jobs, classifies them, dispatches to OpenCode server |
| End-to-end smoke test | "Generate a blog post about X" → classification → producer → reviewer → output |

### Phase 2 - Core MCPs & Per-Project (Weeks 5–6)

**Goal:** All core MCPs operational, per-project isolation working.

| Task | Deliverable |
|---|---|
| Integrate github-mcp | Content versioned in repos, PR-based review workflow |
| Integrate postgres-mcp | Analyst agent queries client data for reporting |
| Integrate cms-mcp | Publisher agent pushes content to CMS |
| Integrate analytics-mcp | Analyst agent pulls GA4/Umami data for reports |
| Integrate email-mcp | Orchestrator sends completed deliverables to clients |
| Per-project `.opencode/` directory structure | Each client project has isolated config, agents, skills |
| Per-client OpenRouter API keys with usage limits | Cost tracking per project, budget enforcement |
| Central cost dashboard (MVP) | Daily/weekly/monthly spend per project, alert thresholds |

### Phase 3 - Expansion & Polish (Weeks 7–8)

**Goal:** Creative MCPs, full cost dashboard, production hardening.

| Task | Deliverable |
|---|---|
| Integrate image-gen-mcp | Producer generates hero images, social graphics |
| Integrate video-gen-mcp | Producer generates short-form video clips |
| Integrate canva-mcp | Producer creates template-based designs |
| Integrate openrouter-mcp | Direct model access for custom/experimental prompts |
| Integrate stripe-mcp | Billing integration, usage-based invoicing |
| Full cost dashboard with charts and exports | Historical usage, per-model breakdown, export to CSV |
| Iterative refinement loop | Reviewer triggers `refine()` up to 3 iterations, auto-approve above 0.9 score |
| Load testing and concurrency tuning | 20 concurrent jobs across 4 projects, <2s p95 latency for classification |
| Documentation and runbooks | Operator guide, client onboarding guide, incident response runbook |
