# AI Tools Integration

Every Quark-scaffolded project ships with pre-configured context for popular AI coding tools. This means Claude Code, Cursor, GitHub Copilot, Continue.dev, Cody, and compatible tools understand your project's conventions, UI system, data layer, auth patterns, and deployment model from the moment you open the project.

## Your First AI Session

After scaffolding, the fastest way to start building is a single focused prompt. The AI already knows your full stack from `CLAUDE.md` - you just tell it what to build.

**Template:**

```
I'm building [your-app-name] - [one sentence: what it does and who it's for].

The first feature I need is [describe the core thing: e.g. "a blog with posts, tags, and an author profile"].

Start by:
1. Reviewing CLAUDE.md so you understand the full stack
2. Adding the Prisma models to packages/db/prisma/schema.prisma
3. Creating query helpers in packages/db/src/queries.js
4. Building the pages in apps/web/src/app/ using our Tailwind UI components
```

**Example (SaaS with user workspaces):**

```
I'm building Acme - a project management tool for small teams.

The first feature I need is a workspace + project structure: users belong to workspaces, workspaces have projects, projects have tasks.

Start by:
1. Reviewing CLAUDE.md
2. Adding Workspace, Project, and Task models to the Prisma schema (with proper relations)
3. Adding query helpers for each
4. Building a /dashboard page that lists the user's workspaces
```

The AI immediately produces idiomatic code: correct imports, Zod-validated Server Actions, proper error types, no `console.log`, Tailwind-only styles. You don't explain your stack - ever.

---

## What Gets Generated

When you run `npx @techstream/quark-create-app my-app`, the following AI context files are created with your project's actual scope, selected packages, and scaffold date already substituted:

| File | Tool(s) | Purpose |
|---|---|---|
| `MAIN.md` | Any tool / human | Project brief and "read this first" entry point routing to CLAUDE.md, docs/, openapi.yaml, and skills |
| `CLAUDE.md` | Claude Code, Aider, any tool reading CLAUDE.md | Full project reference: stack, patterns, key files, all layers |
| `.cursor/rules/quark.mdc` | Cursor | `alwaysApply` rule set - compact, actionable, fires on every file |
| `.github/copilot-instructions.md` | GitHub Copilot, Continue.dev, Cody, Zed | Inline conventions + VS Code skill pointer |
| `.github/skills/project-context/SKILL.md` | GitHub Copilot (VS Code) | Rich structured skill for the Copilot skill system |

All files contain your project's actual `@scope`, selected packages, and scaffold date - no placeholders remain after scaffolding.

## Embedded Skills

Every scaffold also ships domain skills (bookings, CRM, CMS, AI assistant, plus `add-model`, `add-endpoint`, `add-dashboard` recipes) that teach your AI tool how to extend the project using Quark's exact patterns. Use the `--harness` flag to choose where they are placed for auto-loading:

```bash
npx @techstream/quark-create-app my-app --harness claude    # .claude/skills/
npx @techstream/quark-create-app my-app --harness copilot   # .github/skills/
npx @techstream/quark-create-app my-app                     # default: .opencode/skills/
```

Scaffolded docs (`MAIN.md`, `CLAUDE.md`, `README.md`) reference the selected harness's skill directory automatically.

## What Each Tool Uses

### Claude Code

Automatically reads `CLAUDE.md` at the project root. This is the most comprehensive reference - it covers every development layer at the right depth for Claude to produce idiomatic code across UI, API, database, auth, jobs, testing, and deployment without being told.

### Cursor

Reads `.cursor/rules/quark.mdc` with `alwaysApply: true` - applies to every file in the project. Optimised for concise, always-on rules rather than documentation prose. Cursor also reads `CLAUDE.md` when available.

### GitHub Copilot (VS Code)

Uses the skill system via `.github/copilot-instructions.md`, which declares the `project-context` skill pointing at `.github/skills/project-context/SKILL.md`. The skill file is rich, structured, and specifically formatted for VS Code Copilot's context system.

### Continue.dev, Cody, Zed, Windsurf, and others

These tools read `.github/copilot-instructions.md` as raw markdown when they detect it. The file includes explicit inline conventions (not just a skill pointer) so these tools get useful context without needing VS Code or the Copilot skill system.

## Keeping Context Current

The generated files are **yours to own**. They are not auto-updated when you run `quark update` - they're living documentation. Update them when you make structural changes.

**Update `CLAUDE.md` when you:**
- Add a new package (`@scope/notifications`, etc.)
- Change your deployment target
- Adopt a new major convention (e.g. a new auth pattern)
- Add a significant new model or domain

**Update `.github/skills/project-context/SKILL.md` when you:**
- Add packages, models, or API patterns
- Change environment variable names
- Update team conventions

**Update `.cursor/rules/quark.mdc` when you:**
- Change an import convention or scope
- Add rules for a new layer (e.g. new job pattern)

The copilot-instructions.md typically needs less frequent updates since it defers to SKILL.md for depth.

## Extending with Custom Rules

All generated files are good defaults - extend, don't replace. Add your own rules beneath the generated content.

**Custom Cursor rule example:**

```markdown
## Custom Rules

- All date formatting must use `date-fns` - no `new Date().toLocaleDateString()`.
- Feature flags live in `packages/config/src/flags.js`.
```

**Custom CLAUDE.md section example:**

```markdown
## Domain Conventions

### Billing
- All Stripe interactions go through `apps/web/src/lib/stripe.js`.
- Never store payment methods in our DB - use Stripe Customer ID only.
- Webhook handler: `apps/web/src/app/api/stripe/webhook/route.js`.
```

## For Quark Contributors

The monorepo has its own `CLAUDE.md` at the repository root targeting contributors, not app developers. It covers the monorepo architecture, template sync workflow, changeset release process, and testing requirements.

The scaffold template files (`packages/cli/templates/base-project/CLAUDE.md`, `.cursor/rules/quark.mdc`, `copilot-instructions.md`) contain `__QUARK_*__` placeholders and are listed in `TEMPLATE_ONLY` in `sync-templates.js` - they are never overwritten by the contributor tool that syncs source code into templates.
