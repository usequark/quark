---
'@techstream/quark-core': minor
'@techstream/quark-create-app': minor
---

AI chat system, UI theming engine, SMS service, CRM package, and expanded deployment tooling

**@techstream/quark-core**
- New SMS service module with pluggable provider pattern (Twilio built-in, custom provider registry via `registerSmsProvider`)
- New admin authentication module (`admin-auth.js`) for admin-only route protection
- New database instrumentation module (`db-instrumentation.js`) with Prometheus metrics (`db-metrics.js`) for query monitoring
- Queue improvements: `addRepeatableJob` utility using atomic `upsertJobScheduler`, `dedupKey` support for job deduplication with configurable TTL, `removeOnComplete` retention settings
- Auth: `trustHost` auto-detection for Railway and non-localhost deployments
- Dependency: nodemailer ^7 → ^9

**@techstream/quark-create-app**
- AI chat system: persistent conversations with Claude-style UI (sidebar, message bubbles, streaming indicators), rate limiting, truncation, OpenCode integration, context extraction, permission-based tool routing with full test suites, `throw new Error` → `AppError` in handler
- UI theming engine: refactor all 20+ components to CSS custom properties, ship 8 design preset themes (brutalist-yellow, red-noir, editorial-coral, soft-wellness, playful-geometric, hyper-saturated, season-04, swiss-minimalist), design-system skill for AI agents
- CRM package: pipeline tracking with Kanban board, stage columns, client_admin role, config and validation
- OpenCode deployment templates: server config, agent prompts, skills (accessibility, audience-research, data-analysis, distribution, skill-builder), MCP tools (getTasks, getRelevantContext)
- Admin UI: new image picker component, sidebar redesign, theme toggle, db-health route, action toast notifications
- CMS: page builder drag-and-drop improvements, cover image field refactor, cms-public scaffold split for cleaner project structure
- Auth: PasswordInput with visibility toggle, trustHost detection in scaffolded auth config
- Umami analytics: Core Web Vitals tracking component, replay recorder component
- Config: environment validation for AI features, SEO indexing gate hardened (dual `NODE_ENV` + `ALLOW_INDEXING` check), `pnpm.overrides` restore in scaffolded package.json
- DB: conversation summary model, context model, AI/CRM model migrations, context.js utility with test suite
- Railway deployment: service validation before deploy, .env.railway.example template, check-loading script, deploy integration test fixes
- Security: Docker base image bump for CVE-2026-45447, Dockerfile `apk upgrade` stage, nodemailer bump
