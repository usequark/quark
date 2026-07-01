# Marketing, Branding & Social Media Pipeline

> **Status:** Implementation-ready  
> **Audience:** Internal team (Techstream)  
> **Delivery model:** AI-generated → AI-reviewed → Human-reviewed → Client (email/messaging)  
> **Platform:** OpenCode deployment with BullMQ job orchestration  
> **OpenCode fork:** Lives in a separate `opencode-techstream` repo — all agent, model routing, and delegation logic is developed there before integration

---

## Pipeline Philosophy

| Principle | Description |
|---|---|
| **AI generates, AI reviews** | Every output is produced by one model and audited by a different model before human review |
| **Human is the gate** | No AI output reaches a client without human review and personalization |
| **Personal touch is the value-add** | AI handles production volume and consistency; humans handle relationship, nuance, and final polish |
| **No self-serve portal** | Results delivered via email or messaging to maintain personal connection |
| **Iterative by design** | Revision cycles are expected and budgeted — not treated as failures |

---

## Phase 0: Internal Task Management

**Trigger:** Client request arrives via email/messaging  
**Purpose:** Automate Techstream's own Kanban board before any client-facing automation  
**Why first:** This proves the OpenCode fork, model routing, agent delegation, and human-in-the-loop review all work before any client touches it

### Step 1: Request Classification

| Field | Value |
|---|---|
| **Agent** | `@orchestrator` |
| **Model** | DeepSeek Flash |
| **Inputs** | Raw client message (email/messaging), client context, historical requests |
| **Outputs** | Classified request type: `content`, `seo`, `design`, `bug_fix`, `strategy`, `analytics`, `general` |
| **Human touchpoint** | No |

### Step 2: Task Creation

| Field | Value |
|---|---|
| **Agent** | `@orchestrator` |
| **Model** | DeepSeek Pro |
| **Inputs** | Classified request type, raw client message, client context |
| **Outputs** | Kanban task with populated details: title, description, priority (low/medium/high/critical), estimated effort (story points), suggested agent/skill assignment |
| **Human touchpoint** | No |

### Step 3: Human Review & Approval

| Field | Value |
|---|---|
| **Agent** | N/A (human) |
| **Inputs** | AI-generated Kanban task |
| **Outputs** | Adjusted task details (if needed), approved task ready for execution |
| **Human touchpoint** | Yes — review, adjust, approve |

### Step 4: Work Execution

| Field | Value |
|---|---|
| **Agent** | Various (`@developer`, `@designer`, `@architect`, `@analytics`) |
| **Model** | DeepSeek Flash / Pro (task-dependent) |
| **Inputs** | Approved task, client context, project files |
| **Outputs** | Completed work, task status updated automatically |
| **Human touchpoint** | No (AI updates task status as work progresses through agents) |

### Step 5: Weekly Team Summary

| Field | Value |
|---|---|
| **Agent** | `@orchestrator` |
| **Model** | DeepSeek Pro |
| **Inputs** | All in-progress and completed tasks for the week |
| **Outputs** | Team summary: completed items, in-progress items with status, blocked items, upcoming priorities |
| **Human touchpoint** | No (auto-generated, reviewed by team) |

### Phase 0 Success Criteria

| Criteria | Description |
|---|---|
| **Classification accuracy** | AI correctly classifies 90%+ of incoming requests without human correction |
| **Task quality** | AI-generated task details require minimal human editing (<20% of fields adjusted) |
| **Status automation** | Task status updates correctly as agents complete work without manual intervention |
| **Summary usefulness** | Weekly summaries provide actionable overview; team uses them for standups |
| **Pipeline confidence** | Team trusts the AI pipeline enough to begin Phase 1 (client-facing onboarding) |

---

## Workflow 1: New Client Onboarding (Brand + Site)

**Trigger:** New client signed ($1,500 one-time setup fee)  
**Duration:** 5–7 business days  
**Human touchpoints:** 3 (discovery call, mid-point check-in, launch review)

### Step 1: Discovery Call (Human-led)

| Field | Value |
|---|---|
| **Agent** | N/A (human) |
| **Inputs** | Client intake form, initial consult notes |
| **Outputs** | Structured discovery doc (brand preferences, competitors, audience, tone, must-haves) |
| **Human touchpoint** | Yes — this is the call itself |

### Step 2: Brand Strategy

| Field | Value |
|---|---|
| **Agent** | `@architect` |
| **Model** | DeepSeek Pro (reasoning-first) |
| **Inputs** | Discovery doc, competitor URLs, industry context |
| **Outputs** | Brand strategy document: positioning, voice/tone guidelines, visual direction, audience personas, competitive differentiation |
| **Human touchpoint** | No (internal generation only) |

### Step 3: Information Architecture Planning

| Field | Value |
|---|---|
| **Agent** | `@architect` |
| **Model** | DeepSeek Pro |
| **Inputs** | Brand strategy doc, competitor site maps, client's existing site (if any) |
| **Outputs** | Site map, page hierarchy, URL structure, content inventory per page, navigation schema |
| **Human touchpoint** | No |

### Step 4: Design Tokens

| Field | Value |
|---|---|
| **Agent** | `@designer` |
| **Model** | DeepSeek Flash (fast iteration) |
| **Inputs** | Brand strategy doc, IA plan, client preferences on colors/typography |
| **Outputs** | CSS custom properties file: color palette (primary, secondary, neutral, semantic), typography scale, spacing scale, border radii, shadows, dark mode variants |
| **Human touchpoint** | No |

### Step 5: Content Draft

| Field | Value |
|---|---|
| **Agent** | `@developer` (content writer role) |
| **Model** | DeepSeek Flash |
| **Inputs** | IA plan, brand strategy, design tokens, client-provided assets |
| **Outputs** | Draft copy for all pages (hero, features, about, contact, etc.), meta titles/descriptions, alt text for images |
| **Human touchpoint** | No |

### Step 6: Site Build

| Field | Value |
|---|---|
| **Agent** | `@developer` |
| **Model** | DeepSeek Flash |
| **Inputs** | Design tokens, IA plan, content draft, Quark scaffold |
| **Outputs** | Fully built Next.js site with all pages, components, responsive layouts, SEO metadata |
| **Human touchpoint** | No |

### Step 7: Design Review

| Field | Value |
|---|---|
| **Agent** | `@reviewer` |
| **Model** | Gemini (vision-capable, strong at visual QA) |
| **Inputs** | Screenshots of built site, design tokens, brand strategy doc |
| **Outputs** | Review report: visual consistency issues, accessibility gaps, responsive breakpoint problems, brand alignment score |
| **Human touchpoint** | No |

### Step 8: Human Review + Launch

| Field | Value |
|---|---|
| **Agent** | N/A (human) |
| **Inputs** | Built site, design review report, content draft |
| **Outputs** | Final polish, personalization notes, launch checklist |
| **Human touchpoint** | Yes — final review, client walkthrough, launch |

---

## Workflow 2: Monthly Content Package

**Trigger:** Scheduled monthly ($1,000/mo management)  
**Duration:** 3–4 business days  
**Human touchpoints:** 1 (final review before delivery)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    MONTHLY CONTENT PACKAGE                           │
│                                                                      │
│  ┌──────────────┐                                                    │
│  │ Step 1       │  Content Planning                                  │
│  │ @architect   │  Model: DeepSeek Pro                               │
│  │              │  Output: Monthly content calendar + topic briefs   │
│  └──────┬───────┘                                                    │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Step 2: Parallel Generation                      │   │
│  │                                                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │   │
│  │  │ Content Writer  │  │ Social Media    │  │ SEO Auditor   │  │   │
│  │  │ @developer      │  │ Manager         │  │ @analytics    │  │   │
│  │  │ Flash           │  │ @developer      │  │ Flash         │  │   │
│  │  │                 │  │ Flash           │  │               │  │   │
│  │  │ Blog posts      │  │ Platform posts  │  │ Keyword       │  │   │
│  │  │ Email drafts    │  │ (LinkedIn, X,   │  │ research      │  │   │
│  │  │ Case studies    │  │  Instagram, FB) │  │ Competitor    │  │   │
│  │  │                 │  │ Captions        │  │ gap analysis  │  │   │
│  │  │                 │  │ Hashtag sets    │  │ SERP tracking │  │   │
│  │  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘  │   │
│  │           │                    │                   │          │   │
│  └───────────┼────────────────────┼───────────────────┼──────────┘   │
│              │                    │                   │              │
│              ▼                    ▼                   ▼              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Step 3: Quality Review (Parallel)               │   │
│  │                                                               │   │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐    │   │
│  │  │ Copy Auditor            │  │ SEO Verifier            │    │   │
│  │  │ @reviewer               │  │ @reviewer               │    │   │
│  │  │ Gemini                  │  │ DeepSeek Pro            │    │   │
│  │  │                         │  │                         │    │   │
│  │  │ Grammar, tone, brand    │  │ Keyword density         │    │   │
│  │  │ voice consistency       │  │ Readability scores      │    │   │
│  │  │ Plagiarism check        │  │ Meta tag validation     │    │   │
│  │  │ Reading level           │  │ Internal linking        │    │   │
│  │  │ Call-to-action strength │  │ Schema markup check     │    │   │
│  │  └────────────┬────────────┘  └────────────┬────────────┘    │   │
│  │               │                            │                  │   │
│  └───────────────┼────────────────────────────┼──────────────────┘   │
│                  │                            │                      │
│                  └──────────┬─────────────────┘                      │
│                             ▼                                        │
│                    ┌────────────────┐                                │
│                    │ Step 4         │  Human Review                  │
│                    │ Human          │  Personalize, polish, approve  │
│                    └───────┬────────┘                                │
│                            │                                         │
│                            ▼                                         │
│                    ┌────────────────┐                                │
│                    │ Step 5         │  Delivery                      │
│                    │ Human          │  Email to client with summary  │
│                    └────────────────┘                                │
└──────────────────────────────────────────────────────────────────────┘
```

### Step Details

#### Step 1: Content Planning

| Field | Value |
|---|---|
| **Agent** | `@architect` |
| **Model** | DeepSeek Pro |
| **Inputs** | Previous month analytics, client goals, industry calendar, seasonal topics, keyword trends |
| **Outputs** | Monthly content calendar (dates, topics, formats, channels), topic briefs with outlines and target keywords |
| **Human touchpoint** | No |

#### Step 2: Parallel Generation

**Content Writer**

| Field | Value |
|---|---|
| **Agent** | `@developer` (content writer role) |
| **Model** | DeepSeek Flash |
| **Inputs** | Topic briefs, brand voice guidelines, SEO keywords |
| **Outputs** | Blog posts (800–1500 words), email newsletter drafts, case study drafts, landing page copy |

**Social Media Manager**

| Field | Value |
|---|---|
| **Agent** | `@developer` (social media role) |
| **Model** | DeepSeek Flash |
| **Inputs** | Topic briefs, platform-specific format guides, brand voice, hashtag strategy |
| **Outputs** | Platform-specific posts (LinkedIn, X/Twitter, Instagram, Facebook), captions, hashtag sets, image briefs for designer |

**SEO Auditor**

| Field | Value |
|---|---|
| **Agent** | `@analytics` |
| **Model** | DeepSeek Flash |
| **Inputs** | Client domain, competitor domains, target keywords |
| **Outputs** | Keyword research report, competitor gap analysis, SERP position tracking, content optimization recommendations |

#### Step 3: Quality Review (Parallel)

**Copy Auditor**

| Field | Value |
|---|---|
| **Agent** | `@reviewer` |
| **Model** | Gemini (strong language understanding) |
| **Inputs** | All generated content, brand voice guidelines |
| **Outputs** | Grammar/spelling report, tone consistency score, brand voice alignment %, reading level assessment, CTA effectiveness score, flagged issues |

**SEO Verifier**

| Field | Value |
|---|---|
| **Agent** | `@reviewer` |
| **Model** | DeepSeek Pro |
| **Inputs** | All generated content, SEO auditor report, keyword targets |
| **Outputs** | Keyword density check, meta tag validation, internal linking audit, schema markup verification, readability vs. target comparison |

#### Step 4: Human Review

| Field | Value |
|---|---|
| **Agent** | N/A (human) |
| **Inputs** | All generated content, both review reports |
| **Outputs** | Finalized content package with personal touches, client-specific notes |
| **Human touchpoint** | Yes — the review itself |

#### Step 5: Delivery

| Field | Value |
|---|---|
| **Agent** | N/A (human) |
| **Inputs** | Finalized content package |
| **Outputs** | Email to client with summary, links, and next-month preview |
| **Human touchpoint** | Yes — personal email |

---

## Workflow 3: Monthly Analytics Report

**Trigger:** Scheduled monthly (included in $1,000/mo management)  
**Duration:** 1–2 business days  
**Human touchpoints:** 1 (review before delivery)

### Step 1: Data Collection

| Field | Value |
|---|---|
| **Agent** | `@analytics` |
| **Model** | DeepSeek Flash |
| **Inputs** | Client's Google Analytics / Umami / Plausible data, Search Console data, social platform analytics, CRM data |
| **Outputs** | Aggregated data set: traffic, conversions, engagement, social metrics, email performance, top content |
| **Human touchpoint** | No |

### Step 2: Report Generation

| Field | Value |
|---|---|
| **Agent** | `@developer` (report builder role) |
| **Model** | DeepSeek Flash |
| **Inputs** | Aggregated data, previous month report, client goals |
| **Outputs** | Formatted report: executive summary, KPI dashboard, trend charts, top/bottom performers, recommendations, comparison vs. previous month and same month last year |
| **Human touchpoint** | No |

### Step 3: Human Review

| Field | Value |
|---|---|
| **Agent** | N/A (human) |
| **Inputs** | Generated report, raw data |
| **Outputs** | Annotated report with personal insights, context, and strategic commentary |
| **Human touchpoint** | Yes |

### Step 4: Delivery

| Field | Value |
|---|---|
| **Agent** | N/A (human) |
| **Inputs** | Annotated report |
| **Outputs** | Email to client with report attached and key takeaways |
| **Human touchpoint** | Yes |

---

## Workflow 4: Quarterly Strategy Review

**Trigger:** Every 3 months (included in $1,000/mo management)  
**Duration:** 3–5 business days  
**Human touchpoints:** 2 (review + client call)

### Step 1: Performance Analysis

| Field | Value |
|---|---|
| **Agent** | `@architect` |
| **Model** | DeepSeek Pro (reasoning-heavy analysis) |
| **Inputs** | Last 3 monthly reports, original strategy doc, industry trends, competitor movements |
| **Outputs** | Quarterly performance analysis: what worked, what didn't, ROI by channel, audience growth, competitive positioning shifts |
| **Human touchpoint** | No |

### Step 2: Strategy Document

| Field | Value |
|---|---|
| **Agent** | `@architect` |
| **Model** | DeepSeek Pro |
| **Inputs** | Performance analysis, client feedback from quarter, market trends, upcoming opportunities |
| **Outputs** | Updated strategy document: revised goals, new channel recommendations, content pivot suggestions, budget reallocation proposals, next-quarter roadmap |
| **Human touchpoint** | No |

### Step 3: Human Review

| Field | Value |
|---|---|
| **Agent** | N/A (human) |
| **Inputs** | Strategy document, performance analysis |
| **Outputs** | Annotated strategy, talking points for client call, slide deck (if needed) |
| **Human touchpoint** | Yes |

### Step 4: Client Strategy Call

| Field | Value |
|---|---|
| **Agent** | N/A (human) |
| **Inputs** | Annotated strategy, talking points |
| **Outputs** | Call notes, agreed action items, revised strategy (if client pivots) |
| **Human touchpoint** | Yes — the call itself |

---

## BullMQ Integration

All workflows are orchestrated via BullMQ job queues running on the OpenCode deployment. Each workflow has its own queue with typed job payloads.

### Queue Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      BullMQ (Redis-backed)                   │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ onboarding-queue │  │ content-queue    │                 │
│  │ (Workflow 1)     │  │ (Workflow 2)     │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ analytics-queue  │  │ strategy-queue   │                 │
│  │ (Workflow 3)     │  │ (Workflow 4)     │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ review-queue (cross-cutting)                         │   │
│  │ Items awaiting human review from all workflows       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Queue: `onboarding-queue`

**Purpose:** New client onboarding workflow (Workflow 1)

**Job Payload:**

```json
{
  "clientId": "string",
  "workflow": "onboarding",
  "step": "brand_strategy | ia_planning | design_tokens | content_draft | site_build | design_review",
  "inputs": {
    "discoveryDoc": "string (JSON)",
    "competitorUrls": ["string"],
    "industryContext": "string",
    "previousStepOutput": "string (JSON)"
  },
  "metadata": {
    "retryCount": 0,
    "maxRetries": 3,
    "priority": "high"
  }
}
```

**Worker Behavior:**

1. Dequeue job, read `step` field
2. Route to appropriate agent (`@architect`, `@designer`, `@developer`, `@reviewer`)
3. Call OpenCode server via internal API with agent prompt and inputs
4. Store output in client's project directory
5. If step is not final, enqueue next step with `previousStepOutput` set
6. If step is `design_review`, enqueue to `review-queue` for human review

**Step Chain:**

```
brand_strategy → ia_planning → design_tokens → content_draft → site_build → design_review → human_review
```

### Queue: `content-queue`

**Purpose:** Monthly content package (Workflow 2)

**Job Payload:**

```json
{
  "clientId": "string",
  "workflow": "monthly_content",
  "step": "content_planning | content_writer | social_media | seo_audit | copy_audit | seo_verify | human_review",
  "inputs": {
    "previousAnalytics": "string (JSON)",
    "clientGoals": ["string"],
    "industryCalendar": ["string"],
    "keywordTrends": ["string"],
    "previousStepOutput": "string (JSON)"
  },
  "metadata": {
    "retryCount": 0,
    "maxRetries": 3,
    "priority": "normal",
    "scheduledMonth": "2026-07"
  }
}
```

**Worker Behavior:**

1. Dequeue job, read `step`
2. If `step === "content_planning"`: run `@architect` with DeepSeek Pro, then enqueue 3 parallel jobs (`content_writer`, `social_media`, `seo_audit`)
3. If `step` is a generation step: run `@developer` or `@analytics` with DeepSeek Flash, store output, enqueue corresponding review step
4. If `step` is a review step: run `@reviewer` with appropriate model, store report
5. When all review steps complete, enqueue to `review-queue` for human review

**Parallel Fan-out:**

```
content_planning
    │
    ├── content_writer ──→ copy_audit ──┐
    ├── social_media ────→ copy_audit ──┤ (social posts also go through copy audit)
    └── seo_audit ───────────────────────┤
                                         │
                                    seo_verify (runs after all generation + seo_audit complete)
                                         │
                                    human_review
```

### Queue: `analytics-queue`

**Purpose:** Monthly analytics report (Workflow 3)

**Job Payload:**

```json
{
  "clientId": "string",
  "workflow": "monthly_analytics",
  "step": "data_collection | report_generation | human_review",
  "inputs": {
    "analyticsSources": {
      "googleAnalytics": "string (API key ref)",
      "searchConsole": "string (API key ref)",
      "socialPlatforms": ["string"],
      "crmData": "string (JSON)"
    },
    "previousReport": "string (JSON)",
    "clientGoals": ["string"]
  },
  "metadata": {
    "retryCount": 0,
    "maxRetries": 2,
    "priority": "normal",
    "scheduledMonth": "2026-07"
  }
}
```

**Worker Behavior:**

1. `data_collection`: `@analytics` with Flash — fetch from all sources, normalize, store
2. `report_generation`: `@developer` with Flash — build formatted report from data
3. `human_review`: enqueue to `review-queue`

### Queue: `strategy-queue`

**Purpose:** Quarterly strategy review (Workflow 4)

**Job Payload:**

```json
{
  "clientId": "string",
  "workflow": "quarterly_strategy",
  "step": "performance_analysis | strategy_document | human_review",
  "inputs": {
    "monthlyReports": ["string (JSON)"],
    "originalStrategy": "string (JSON)",
    "industryTrends": "string",
    "competitorMovements": "string",
    "clientFeedback": "string"
  },
  "metadata": {
    "retryCount": 0,
    "maxRetries": 2,
    "priority": "high",
    "scheduledQuarter": "2026-Q3"
  }
}
```

**Worker Behavior:**

1. `performance_analysis`: `@architect` with Pro — deep analysis of 3 months of data
2. `strategy_document`: `@architect` with Pro — build updated strategy from analysis
3. `human_review`: enqueue to `review-queue`

### Queue: `review-queue`

**Purpose:** Cross-cutting human review queue for all workflows

**Job Payload:**

```json
{
  "clientId": "string",
  "clientName": "string",
  "workflow": "onboarding | monthly_content | monthly_analytics | quarterly_strategy",
  "outputType": "site_build | content_package | analytics_report | strategy_doc",
  "outputPath": "string (file path to generated output)",
  "reviewReports": ["string (JSON)"],
  "costSummary": {
    "tokensUsed": 0,
    "estimatedCost": 0,
    "revisionCycles": 0
  },
  "metadata": {
    "createdAt": "ISO8601",
    "priority": "normal | high",
    "dueBy": "ISO8601"
  }
}
```

### Error Handling & Retry Logic

| Scenario | Behavior |
|---|---|
| **Agent call fails (network/timeout)** | Retry up to `maxRetries` with exponential backoff (1min, 5min, 15min) |
| **Agent returns malformed output** | Retry once with stricter prompt; if still malformed, flag for human intervention |
| **Model rate-limited** | Back off for 60s, retry; if persists, switch to fallback model (Pro → Flash, Flash → Pro) |
| **Dependency step failed** | Cancel dependent jobs; notify human via internal dashboard |
| **Human review overdue (>48h)** | Escalate notification (dashboard badge → Slack DM → email) |
| **Redis connection lost** | BullMQ handles reconnection automatically; jobs persist in Redis |
| **Worker crash mid-job** | BullMQ moves job back to waiting state; picked up by next available worker |

### How Workers Call the OpenCode Server

Workers run as a Node.js process alongside the OpenCode server. They invoke agents via an internal HTTP API:

```
POST /internal/agent/run
{
  "agent": "@architect",
  "model": "deepseek-pro",
  "prompt": "...",
  "context": { ... },
  "clientId": "..."
}
```

The OpenCode server routes this to the appropriate agent, streams output back, and returns the final result. Workers poll for completion and store results to the client's project directory.

---

## Human Review Dashboard (Internal Only)

A simple internal dashboard for the team to manage the review pipeline. Not client-facing.

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  HUMAN REVIEW DASHBOARD                    [Filter: All ▼]       │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  ⚠ 3 awaiting review    ✓ 12 delivered this month    $847.32 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Client         │ Workflow      │ Status      │ Actions       │ │
│  ├────────────────┼───────────────┼─────────────┼───────────────┤ │
│  │ Acme Corp      │ Onboarding    │ Generated   │ [Approve]     │ │
│  │                │ (Site Build)  │ 2h ago      │ [Revise]      │ │
│  │                │               │             │ [Send]        │ │
│  ├────────────────┼───────────────┼─────────────┼───────────────┤ │
│  │ Beta Inc       │ Monthly       │ Generated   │ [Approve]     │ │
│  │                │ Content       │ 4h ago      │ [Revise]      │ │
│  │                │               │             │ [Send]        │ │
│  ├────────────────┼───────────────┼─────────────┼───────────────┤ │
│  │ Gamma LLC      │ Monthly       │ Reviewed    │ [Send]        │ │
│  │                │ Analytics     │ 1d ago      │               │ │
│  ├────────────────┼───────────────┼─────────────┼───────────────┤ │
│  │ Delta Co       │ Quarterly     │ Delivered   │ [View]        │ │
│  │                │ Strategy      │ 3d ago      │               │ │
│  └────────────────┴───────────────┴─────────────┴───────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ COST TRACKING (This Month)                                    │ │
│  │                                                               │ │
│  │ Acme Corp      ████████████░░░░░░  $124.32  (3 revisions)    │ │
│  │ Beta Inc       ██████░░░░░░░░░░░░   $67.21  (1 revision)     │ │
│  │ Gamma LLC      ████░░░░░░░░░░░░░░   $42.10  (0 revisions)    │ │
│  │ Delta Co       ████████████████░░  $189.45  (2 revisions)    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Features

| Feature | Description |
|---|---|
| **Queue view** | All AI-generated content awaiting human review, sorted by priority and age |
| **Per-client status** | Three-state tracker: `generated` → `reviewed` → `delivered` |
| **Quick actions** | Approve (marks reviewed, queues delivery), Request Revision (returns to agent with notes), Send (triggers delivery email) |
| **Revision notes** | Free-text field for human to specify what needs changing; fed back to agent |
| **Cost tracking** | Per-client token usage, AI cost, revision cycles, human review time |
| **Alert badges** | Items awaiting review >24h, cost over threshold, revision count >3 |
| **Filtering** | By workflow type, status, client, date range |

---

## Cost Tracking

### Per-Client Monthly Metrics

| Metric | Description | Tracked How |
|---|---|---|
| **Tokens used** | Total input + output tokens across all agent calls | Aggregated from OpenCode API responses |
| **AI cost** | Estimated USD cost based on model pricing | Calculated: tokens × model rate |
| **Revision cycles** | Number of human-requested revisions per output | Incremented on each "Request Revision" action |
| **Human review time** | Time from enqueue to approve/send | Timestamp delta in review queue |
| **Total pipeline time** | Time from workflow trigger to delivery | Job creation timestamp to delivery timestamp |

### Model Pricing (Estimated)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| DeepSeek Pro | $0.55 | $2.19 |
| DeepSeek Flash | $0.14 | $0.55 |
| Gemini | $0.15 | $0.60 |

### Alert Thresholds

| Threshold | Alert | Action |
|---|---|---|
| **Per-client monthly cost > $300** | Dashboard badge + Slack notification | Review client profitability; consider efficiency improvements |
| **Revision cycles > 3 for single output** | Dashboard badge | Review prompt quality; consider human intervention in generation step |
| **Human review pending > 48h** | Slack DM → email escalation | Unblock reviewer or reassign |
| **Single agent call > 100K tokens** | Dashboard warning | Review prompt for unnecessary context; consider chunking |
| **Monthly total spend > $2,000** | Slack notification to team | Review overall pipeline efficiency |

---

## Model Usage Guidelines

| Task | Model | Why |
|---|---|---|
| **Brand strategy** | DeepSeek Pro | Requires deep reasoning, competitive analysis, and structured strategic thinking |
| **IA planning** | DeepSeek Pro | Complex hierarchical reasoning about site structure and user flows |
| **Design tokens** | DeepSeek Flash | Fast, iterative, pattern-based output; doesn't need deep reasoning |
| **Content writing (blog, email, social)** | DeepSeek Flash | High-volume, pattern-based generation; Flash is cost-effective and fast |
| **SEO audit / keyword research** | DeepSeek Flash | Data processing and pattern matching; doesn't need reasoning depth |
| **Site build (code generation)** | DeepSeek Flash | Code generation is Flash's strength; fast iteration for component building |
| **Design review (visual QA)** | Gemini | Vision capabilities for screenshot analysis; strong at visual consistency checks |
| **Copy audit (grammar, tone)** | Gemini | Strong natural language understanding; nuanced tone and style assessment |
| **SEO verification** | DeepSeek Pro | Requires cross-referencing multiple data sources and structured validation |
| **Analytics data collection** | DeepSeek Flash | Data fetching and normalization; no reasoning needed |
| **Report generation** | DeepSeek Flash | Template-based formatting with data insertion |
| **Performance analysis (quarterly)** | DeepSeek Pro | Requires synthesis of 3 months of data, trend identification, strategic insight |
| **Strategy document (quarterly)** | DeepSeek Pro | High-level strategic reasoning and planning |

### Model Selection Rules

1. **Default to Flash** for generation tasks — it's faster and cheaper
2. **Use Pro** when the task requires multi-step reasoning, synthesis across sources, or strategic judgment
3. **Use Gemini** for visual review and nuanced language assessment
4. **Never use the same model** for generation and review of the same output — always cross-validate with a different model
5. **Fallback chain**: If primary model is unavailable → try Flash (if Pro was primary) or Pro (if Flash was primary) → flag for human if both fail

---

## Revision History

| Date | Version | Changes |
|---|---|---|
| 2026-06-24 | 1.0 | Initial implementation-ready document |
