# Orchestrator, Agents & Skills - Asset Production Pipeline

> Implementation-ready reference for configuring the OpenCode agent registry.
> This adapts the orchestrator pattern for **digital asset production** (content, design, marketing) rather than code generation.

---

## 1. Orchestrator Design

### 1.1 Task Classification Gate

Every incoming task passes through this gate before routing.

```
A task is SIMPLE ONLY if EVERY criterion is met:
  □ Single asset type (one blog post, one social post, one page section)
  □ No external data needed (no analytics fetch, no CMS pull)
  □ Template or prior example exists
  □ No client-specific brand adaptation needed
  □ No multi-step workflow (generate → review → publish)

If ANY criterion is NOT met → the task is COMPLEX.
  Route to Strategist first (plan), then Producer (execute), then Reviewer (audit).

If ALL criteria are met → the task is SIMPLE.
  Delegate directly to the appropriate Producer agent.
```

**Examples:**

| Task | Classification | Route |
|---|---|---|
| "Write a 500-word blog post about email marketing" | SIMPLE | Content Writer directly |
| "Create a monthly content package for a SaaS client" | COMPLEX | Campaign Planner → Content Writer → Copy Auditor |
| "Build a landing page for a new product launch" | COMPLEX | Brand Strategist → IA Planner → Site Builder → Design Reviewer |
| "Generate 5 Instagram posts for next week" | SIMPLE | Social Media Manager directly |
| "Full site rebrand with new IA and copy" | COMPLEX | Brand Strategist ∥ IA Planner → Site Builder → Design Reviewer + Copy Auditor |

### 1.2 Parallelization Rules

Independent workstreams are parallelized automatically. The orchestrator identifies non-overlapping sub-tasks and dispatches them concurrently.

| Trigger | Parallel Dispatch |
|---|---|
| Monthly content package | Blog post ∥ Social calendar ∥ SEO audit ∥ Monthly report |
| New site build | Brand strategy ∥ IA plan ∥ Content draft ∥ Component build |
| Campaign launch | Ad copy ∥ Landing page ∥ Email sequence ∥ Social posts |
| Quarterly review | Performance report ∥ SEO audit ∥ Content audit ∥ Brand refresh |

**Rule:** After ALL parallel agents complete → run Reviewer on the combined output as a single deliverable.

### 1.3 Iterative Refinement (Creative Tasks)

Creative work follows a feedback loop rather than a one-shot generation.

```
Generate → Present to human → Incorporate feedback → Regenerate
```

**Constraints:**
- Maintain session continuity using `task_id` across refinement rounds
- Maximum **3 refinement rounds** before escalating to a human-led revision
- Each round must show a **diff** of specific changes from the previous version
- Feedback is applied incrementally - do not regenerate from scratch unless explicitly requested

**Example flow:**
1. Content Writer generates blog post draft → presents to human
2. Human: "Make the tone more casual, add a stat about open rates in paragraph 2"
3. Content Writer (same task_id): revises draft, shows changes, presents again
4. Human: "Good, ship it" → enters quality gate

### 1.4 Orchestrator Permissions

The orchestrator is the central router and coordinator. It does not generate content.

| Capability | Allowed? |
|---|---|
| Classify and route tasks | Yes |
| Compose multi-agent outputs into a single deliverable | Yes |
| Call MCP tools for delivery (email, CMS publish, Slack notify) | Yes |
| Delegate work to sub-agents | Yes |
| Generate content directly | **No** - always routes to a Producer |
| Make creative decisions | **No** - delegates to Strategist agents |
| Audit or review output | **No** - delegates to Reviewer agents |

---

## 2. Agent Architecture

Three categories, eleven agents. Each agent has a defined model, skill dependencies, MCP tool access, and input/output contract.

### 2.1 STRATEGIST Agents

**Model: DeepSeek V4 Pro** - Planning, creative direction, complex decisions. These agents think before acting and produce structured plans that Producer agents execute.

---

#### Agent: Brand Strategist

| Field | Value |
|---|---|
| **Agent ID** | `brand-strategist` |
| **Category** | Strategist |
| **Model** | `deepseek-v4-pro` |
| **Skills** | `brand-design` |
| **MCP Tools** | None (read-only planning) |

**Generates:**
- Color palette (4–6 hex values with usage roles)
- Typography pairings (heading + body, with fallback stack)
- Brand voice guidelines (tone, vocabulary, do/don't examples)
- Visual direction brief (mood, spacing philosophy, imagery style)

**Inputs:**
- Client brief (industry, audience, competitors, existing assets)
- Industry context (vertical norms, differentiation opportunities)
- Competitor analysis (visual and tonal audit of 3–5 competitors)

**Behavior:**
- Presents 2–3 distinct options for client selection
- Iterative: refines chosen direction based on feedback
- Outputs a structured brand brief consumed by Site Builder and Content Writer

---

#### Agent: IA Planner

| Field | Value |
|---|---|
| **Agent ID** | `ia-planner` |
| **Category** | Strategist |
| **Model** | `deepseek-v4-pro` |
| **Skills** | `quark-components` |
| **MCP Tools** | None (read-only planning) |

**Generates:**
- Page structure (sitemap, URL hierarchy)
- Navigation hierarchy (primary, secondary, footer)
- Content outline per page (H1 → H4, section purpose)
- Section wireframes (component-level layout recommendations)

**Inputs:**
- Brand brief (from Brand Strategist or client-provided)
- Content requirements (page list, must-have sections)
- Quark template options (available page templates and components)

**Behavior:**
- Maps content requirements to Quark component catalog
- Flags gaps where custom components are needed
- Outputs an IA document consumed by Site Builder

---

#### Agent: Campaign Planner

| Field | Value |
|---|---|
| **Agent ID** | `campaign-planner` |
| **Category** | Strategist |
| **Model** | `deepseek-v4-pro` |
| **Skills** | `social-media` |
| **MCP Tools** | None (read-only planning) |

**Generates:**
- Marketing strategy (positioning, messaging hierarchy, channel mix)
- Channel plan (which platforms, what content, at what cadence)
- Content calendar framework (themes, dates, content pillars)
- KPI targets (per-channel metrics with benchmarks)

**Inputs:**
- Business goals (launch, growth, retention, awareness)
- Audience data (demographics, behaviors, platform preferences)
- Seasonal context (holidays, industry events, launch timeline)

**Behavior:**
- Produces a campaign brief consumed by Content Writer and Social Media Manager
- Defines content pillars that all campaign assets align to
- Recommends channel mix with rationale

---

### 2.2 PRODUCER Agents

**Model: DeepSeek V4 Flash** - Bulk generation, execution, drafting. These agents produce the actual assets at high throughput.

---

#### Agent: Content Writer

| Field | Value |
|---|---|
| **Agent ID** | `content-writer` |
| **Category** | Producer |
| **Model** | `deepseek-v4-flash` |
| **Skills** | `copywriting`, `seo` |
| **MCP Tools** | None |

**Generates:**
- Blog posts (title, body, meta description, featured image brief)
- Service pages (hero, features, pricing, FAQ, CTA)
- Landing page copy (above-fold, social proof, feature blocks, footer CTA)
- Email sequences (subject lines, body, preview text, CTAs)
- Ad copy (headlines, body, CTAs per platform spec)

**Inputs:**
- Topic or page purpose
- Brand voice guidelines (from Brand Strategist)
- SEO keywords (from SEO Auditor or brief)
- Content brief (from Campaign Planner or direct)

**Outputs:**
- Publish-ready drafts with meta descriptions
- Word count within specified range
- Formatted in markdown with heading hierarchy

**Behavior:**
- Adapts tone and structure to brand voice guidelines
- Incorporates SEO keywords naturally
- Supports iterative refinement (max 3 rounds)

---

#### Agent: SEO Auditor

| Field | Value |
|---|---|
| **Agent ID** | `seo-auditor` |
| **Category** | Producer |
| **Model** | `deepseek-v4-flash` |
| **Skills** | `seo` |
| **MCP Tools** | `playwright-mcp` (page rendering), `analytics-mcp` (performance data) |

**Generates:**
- Site audit report (technical, on-page, off-page findings)
- Meta/title recommendations (per-page optimization)
- Schema markup (JSON-LD for key page types)
- Keyword opportunities (gap analysis, long-tail recommendations)

**Inputs:**
- Site URL (to crawl and analyze)
- Analytics data (traffic, rankings, CTR from analytics-mcp)
- Competitor URLs (for gap analysis)

**Behavior:**
- Uses playwright-mcp to render pages and extract on-page elements
- Uses analytics-mcp to pull performance data (GSC, GA4, or Umami)
- Outputs prioritized recommendations with impact/effort estimates

---

#### Agent: Report Generator

| Field | Value |
|---|---|
| **Agent ID** | `report-generator` |
| **Category** | Producer |
| **Model** | `deepseek-v4-flash` |
| **Skills** | `analytics-reporting` |
| **MCP Tools** | `analytics-mcp`, `postgres-mcp` |

**Generates:**
- Monthly analytics narrative (executive summary, key findings)
- KPI summaries (traffic, conversions, engagement with trend arrows)
- Trend analysis (MoM/YoY comparisons, anomaly detection)
- Recommendations (data-backed action items)

**Inputs:**
- Analytics data (from analytics-mcp or direct export)
- Previous reports (for continuity and trend context)
- Business goals (to frame findings against objectives)

**Behavior:**
- Queries analytics-mcp for raw data, postgres-mcp for historical records
- Generates narrative that explains the "why" behind the numbers
- Formats output as a client-ready report with sections and visuals

---

#### Agent: Social Media Manager

| Field | Value |
|---|---|
| **Agent ID** | `social-media-manager` |
| **Category** | Producer |
| **Model** | `deepseek-v4-flash` |
| **Skills** | `social-media`, `copywriting` |
| **MCP Tools** | None |

**Generates:**
- 30-day content calendar (date, platform, topic, format, status)
- Platform-specific posts (copy, hashtags, image brief, link)
- Hashtag strategy (branded, community, trending sets)
- Image briefs (visual description for designer or AI image generator)

**Inputs:**
- Brand voice guidelines (from Brand Strategist)
- Content pillars (from Campaign Planner)
- Seasonal events and key dates
- Platform specs (character limits, aspect ratios, best practices)

**Behavior:**
- Produces a calendar in structured format (CSV/table)
- Generates platform-adapted variants of the same content pillar
- Includes posting time recommendations per platform

---

#### Agent: Site Builder

| Field | Value |
|---|---|
| **Agent ID** | `site-builder` |
| **Category** | Producer |
| **Model** | `deepseek-v4-flash` |
| **Skills** | `quark-components`, `brand-design` |
| **MCP Tools** | `github-mcp` (commit code) |

**Generates:**
- Quark page components (configured with props)
- Layout composition (component arrangement per page)
- Token application (brand colors, typography, spacing applied to theme)

**Inputs:**
- IA plan (from IA Planner - page structure, wireframes)
- Brand tokens (from Brand Strategist - colors, fonts, spacing)
- Content draft (from Content Writer - copy for each section)
- Quark template (base template to extend)

**Behavior:**
- Composes pages from the Quark component catalog
- Applies brand tokens to the theme configuration
- Commits generated code via github-mcp
- Flags sections that require custom component development

---

### 2.3 REVIEWER Agents

**Model: Gemini 3.5 Flash** - Visual analysis, quality assurance. These agents audit Producer output against brand standards and best practices. Using a different model family reduces echo-chamber bias.

---

#### Agent: Design Reviewer

| Field | Value |
|---|---|
| **Agent ID** | `design-reviewer` |
| **Category** | Reviewer |
| **Model** | `gemini-3.5-flash` |
| **Skills** | `design-review` |
| **MCP Tools** | `playwright-mcp` (capture screenshots) |

**Analyzes:**
- Visual hierarchy (is the eye drawn to the right elements?)
- Spacing consistency (padding, margins, rhythm)
- Brand consistency (colors, typography, imagery match guidelines)
- Accessibility (contrast ratios, focus states, heading order)

**Inputs:**
- Page screenshots (captured via playwright-mcp)
- Brand guidelines (from Brand Strategist)

**Outputs:**
- PASSED / REJECTED with specific findings
- Annotated issues with severity (blocker, major, minor)
- Suggested fixes per issue

**Behavior:**
- Captures screenshots at multiple viewports (mobile, tablet, desktop)
- Compares rendered output against brand token values
- Checks contrast ratios against WCAG AA minimums

---

#### Agent: Copy Auditor

| Field | Value |
|---|---|
| **Agent ID** | `copy-auditor` |
| **Category** | Reviewer |
| **Model** | `gemini-3.5-flash` |
| **Skills** | `copywriting` |
| **MCP Tools** | None |

**Analyzes:**
- Brand voice consistency (does it sound like the brand?)
- Grammar and mechanics (spelling, punctuation, sentence structure)
- Readability (grade level, sentence length, scannability)
- SEO alignment (keyword usage, meta completeness, heading structure)

**Inputs:**
- Content drafts (from Content Writer or Social Media Manager)
- Brand voice guidelines (from Brand Strategist)

**Outputs:**
- PASSED / REJECTED with specific findings
- Inline annotations on problematic passages
- Readability score and grade level

**Behavior:**
- Checks copy against voice guidelines (tone, vocabulary, patterns)
- Flags grammar issues with suggested corrections
- Verifies SEO elements (title length, meta description, keyword density)

---

#### Agent: SEO Verifier

| Field | Value |
|---|---|
| **Agent ID** | `seo-verifier` |
| **Category** | Reviewer |
| **Model** | `gemini-3.5-flash` |
| **Skills** | `seo` |
| **MCP Tools** | `playwright-mcp` (verify rendered output) |

**Analyzes:**
- SEO implementation correctness (are recommendations applied properly?)
- Meta tag completeness (title, description, OG, Twitter cards)
- Schema markup validity (JSON-LD structure and required fields)
- Canonical and hreflang correctness

**Inputs:**
- SEO recommendations (from SEO Auditor)
- Updated pages (URLs or rendered HTML)

**Outputs:**
- PASSED / REJECTED with implementation gaps
- Per-page checklist of applied vs. missing recommendations
- Schema validation errors

**Behavior:**
- Renders pages via playwright-mcp to inspect `<head>` and structured data
- Cross-references recommendations against implemented changes
- Validates JSON-LD against Schema.org requirements

---

## 3. Skill Catalog

Each skill is a markdown file loaded on demand by agents via the `skill()` tool. Skills contain domain knowledge, patterns, templates, and reference material.

| Skill | File | Loaded By | Content |
|---|---|---|---|
| `brand-design` | `skills/brand-design/SKILL.md` | Brand Strategist, Site Builder | Color theory, typography pairing rules, design token generation, Quark rebranding guide, visual hierarchy principles |
| `copywriting` | `skills/copywriting/SKILL.md` | Content Writer, Social Media Manager, Copy Auditor | Voice guideline templates, headline formulas (AIDA, PAS, etc.), CTA patterns, industry-specific templates (SaaS, ecom, local), readability targets |
| `seo` | `skills/seo/SKILL.md` | SEO Auditor, Content Writer, SEO Verifier | Meta tag structure, JSON-LD schema templates, keyword research methodology, Quark SEO patterns (Next.js metadata API, sitemap, robots.txt) |
| `design-review` | `skills/design-review/SKILL.md` | Design Reviewer | Visual hierarchy checklist, spacing rhythm rules, accessibility audit steps (WCAG 2.2 AA), brand consistency heuristics, screenshot annotation format |
| `quark-components` | `skills/quark-components/SKILL.md` | Site Builder, IA Planner | Complete component catalog with props reference, composition patterns, page template structures, theme token API, layout primitives |
| `social-media` | `skills/social-media/SKILL.md` | Social Media Manager, Campaign Planner | Platform specs (character limits, aspect ratios, optimal times), hashtag strategy frameworks, content calendar templates, image dimension reference |
| `analytics-reporting` | `skills/analytics-reporting/SKILL.md` | Report Generator | GA4/Umami metric interpretation, narrative generation frameworks, KPI dashboard templates, MoM/YoY comparison methodology, anomaly detection heuristics |

### Skill Loading Protocol

1. Agent receives task with domain requirements
2. Agent calls `skill("skill-name")` to load relevant skill context
3. Skill content is injected into the agent's context window
4. Agent applies skill patterns and templates to the task
5. Multiple skills can be loaded concurrently for cross-domain tasks

---

## 4. Delegation Rules

First-match-wins routing table. The orchestrator evaluates these in order and routes to the first matching agent.

| Task Domain | Keywords / Triggers | Route To |
|---|---|---|
| Brand strategy, visual identity | brand, colors, typography, logo, visual identity, rebrand, style guide | `brand-strategist` |
| Page structure, navigation | sitemap, navigation, IA, information architecture, page structure, wireframe | `ia-planner` |
| Marketing strategy, campaigns | campaign, marketing strategy, launch plan, channel strategy, go-to-market | `campaign-planner` |
| Blog posts, service pages, email copy | blog, article, service page, landing page copy, email, newsletter, ad copy | `content-writer` |
| SEO audit, meta, schema | SEO, meta tags, schema, keyword, ranking, search engine, sitemap audit | `seo-auditor` |
| Monthly/quarterly reports | report, analytics report, monthly report, KPI summary, performance review | `report-generator` |
| Social media posts, calendars | social media, Instagram, LinkedIn, Twitter/X, Facebook, TikTok, content calendar, hashtag | `social-media-manager` |
| Website page building | build page, create page, component, layout, theme, deploy page | `site-builder` |
| Visual/design quality review | review design, check design, visual QA, design audit, looks good? | `design-reviewer` |
| Copy quality, brand voice | review copy, check copy, proofread, brand voice check, grammar check | `copy-auditor` |
| SEO implementation check | verify SEO, check SEO, SEO QA, validate schema, meta check | `seo-verifier` |

### Ambiguous Tasks

If a task matches multiple domains, the orchestrator:
1. Identifies the **primary** domain (the main deliverable)
2. Routes to the primary agent
3. That agent may request sub-delegation for secondary concerns

**Example:** "Write a blog post and make sure it's SEO optimized"
- Primary: Content Writer (generates the post)
- Secondary: SEO Auditor (provides keyword data first, or Content Writer loads `seo` skill)

---

## 5. Quality Gate Process

Every Producer output passes through a quality gate before reaching the client.

```
┌──────────────┐
│   PRODUCER   │
│  generates   │
│   output     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   REVIEWER   │  (different model family)
│   audits     │
│   output     │
└──────┬───────┘
       │
       ├── REJECTED ──→ Producer revises (max 2 cycles)
       │                    │
       │                    └──→ Reviewer re-audits
       │
       ▼
    PASSED
       │
       ▼
┌──────────────┐
│ HUMAN REVIEW │  Adds personal touch, final polish
│   QUEUE      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  DELIVER TO  │
│   CLIENT     │
└──────────────┘
```

### Gate Rules

| Rule | Detail |
|---|---|
| Reviewer model | Must differ from Producer model (Gemini reviews DeepSeek output) |
| Max revision cycles | 2 automated cycles; if still REJECTED, escalate to human with full history |
| Human always last | No asset reaches the client without human review |
| Gate scope | Reviewers audit the **combined** output when multiple Producers ran in parallel |
| Pass criteria | No blocker issues; majors documented with rationale; minors are advisory |

### Reviewer-Producer Pairings

| Producer | Reviewer | What's Audited |
|---|---|---|
| Content Writer | Copy Auditor | Brand voice, grammar, readability, SEO alignment |
| SEO Auditor | SEO Verifier | Implementation correctness, meta completeness, schema validity |
| Report Generator | Copy Auditor | Narrative quality, data accuracy, recommendation logic |
| Social Media Manager | Copy Auditor | Platform fit, brand voice, hashtag strategy |
| Site Builder | Design Reviewer | Visual hierarchy, spacing, brand consistency, accessibility |

---

## 6. Agent Registry Configuration

This section maps directly to the OpenCode agent configuration. Use these definitions when registering agents in the server.

```jsonc
{
  "agents": {
    "brand-strategist": {
      "category": "strategist",
      "model": "deepseek-v4-pro",
      "skills": ["brand-design"],
      "mcp_tools": [],
      "description": "Generates brand strategy: color palette, typography, voice guidelines, visual direction."
    },
    "ia-planner": {
      "category": "strategist",
      "model": "deepseek-v4-pro",
      "skills": ["quark-components"],
      "mcp_tools": [],
      "description": "Generates information architecture: page structure, navigation, content outlines, wireframes."
    },
    "campaign-planner": {
      "category": "strategist",
      "model": "deepseek-v4-pro",
      "skills": ["social-media"],
      "mcp_tools": [],
      "description": "Generates campaign strategy: marketing plan, channel mix, content calendar framework, KPIs."
    },
    "content-writer": {
      "category": "producer",
      "model": "deepseek-v4-flash",
      "skills": ["copywriting", "seo"],
      "mcp_tools": [],
      "description": "Generates written content: blog posts, service pages, landing pages, emails, ad copy."
    },
    "seo-auditor": {
      "category": "producer",
      "model": "deepseek-v4-flash",
      "skills": ["seo"],
      "mcp_tools": ["playwright-mcp", "analytics-mcp"],
      "description": "Generates SEO audits: technical analysis, meta recommendations, schema markup, keyword opportunities."
    },
    "report-generator": {
      "category": "producer",
      "model": "deepseek-v4-flash",
      "skills": ["analytics-reporting"],
      "mcp_tools": ["analytics-mcp", "postgres-mcp"],
      "description": "Generates performance reports: analytics narrative, KPI summaries, trend analysis, recommendations."
    },
    "social-media-manager": {
      "category": "producer",
      "model": "deepseek-v4-flash",
      "skills": ["social-media", "copywriting"],
      "mcp_tools": [],
      "description": "Generates social media assets: 30-day calendars, platform-specific posts, hashtag strategy, image briefs."
    },
    "site-builder": {
      "category": "producer",
      "model": "deepseek-v4-flash",
      "skills": ["quark-components", "brand-design"],
      "mcp_tools": ["github-mcp"],
      "description": "Generates website pages: component composition, layout, brand token application, code commits."
    },
    "design-reviewer": {
      "category": "reviewer",
      "model": "gemini-3.5-flash",
      "skills": ["design-review"],
      "mcp_tools": ["playwright-mcp"],
      "description": "Audits visual design: hierarchy, spacing, brand consistency, accessibility. Returns PASSED/REJECTED."
    },
    "copy-auditor": {
      "category": "reviewer",
      "model": "gemini-3.5-flash",
      "skills": ["copywriting"],
      "mcp_tools": [],
      "description": "Audits copy quality: brand voice, grammar, readability, SEO alignment. Returns PASSED/REJECTED."
    },
    "seo-verifier": {
      "category": "reviewer",
      "model": "gemini-3.5-flash",
      "skills": ["seo"],
      "mcp_tools": ["playwright-mcp"],
      "description": "Verifies SEO implementation: meta correctness, schema validity, canonical/hreflang. Returns PASSED/REJECTED."
    }
  }
}
```

---

## 7. End-to-End Workflow Examples

### Example A: Monthly Content Package (COMPLEX)

```
Orchestrator classifies: COMPLEX (multi-asset, needs analytics data)

Phase 1 - PLAN (parallel):
  Campaign Planner → content calendar framework, content pillars

Phase 2 - PRODUCE (parallel):
  Content Writer ∥ Social Media Manager ∥ SEO Auditor ∥ Report Generator

Phase 3 - REVIEW (parallel, on combined output):
  Copy Auditor + SEO Verifier → combined audit

Phase 4 - HUMAN:
  Human reviews package, adds personal touches, delivers to client
```

### Example B: Single Blog Post (SIMPLE)

```
Orchestrator classifies: SIMPLE (single asset, template exists, no external data)

Phase 1 - PRODUCE:
  Content Writer → blog post draft

Phase 2 - REVIEW:
  Copy Auditor → PASSED

Phase 3 - HUMAN:
  Human reviews, polishes, publishes
```

### Example C: New Site Build (COMPLEX)

```
Orchestrator classifies: COMPLEX (multi-asset, needs brand adaptation)

Phase 1 - PLAN (parallel):
  Brand Strategist ∥ IA Planner

Phase 2 - PRODUCE (sequential, IA depends on brand):
  Content Writer (uses brand voice) ∥ Site Builder (uses brand tokens + IA plan)

Phase 3 - REVIEW (parallel):
  Design Reviewer + Copy Auditor → combined audit

Phase 4 - HUMAN:
  Human reviews full site, requests refinements, approves launch
```
