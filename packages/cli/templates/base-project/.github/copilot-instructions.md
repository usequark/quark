<skills>
<skill>
<name>project-context</name>
<description>Project-specific context and conventions. This skill evolves with your project — update it as your architecture grows.</description>
<file>.github/skills/project-context/SKILL.md</file>
</skill>
</skills>

# __QUARK_PROJECT_NAME__ — Project Conventions

> Scaffolded with Quark on __QUARK_SCAFFOLD_DATE__. Package scope: `@__QUARK_SCOPE__`
> Also see `CLAUDE.md` at the project root for the full context reference.

## Non-Negotiable Rules

- **ESM only** — `import`/`export` everywhere. Never `require()`.
- **No TypeScript** — `.js` and `.jsx` only.
- **Validate at every boundary** — Zod schemas on all Server Actions and API routes.
- **Errors** — `AppError` / `ValidationError` from `@techstream/quark-core/errors`. Never `throw new Error()`.
- **Logging** — `createLogger(name)` from `@techstream/quark-core`. No `console.log` in production code.
- **DB models** — Always add `createdAt` and `updatedAt` to every Prisma model.
- **Workspace imports** — Use `@__QUARK_SCOPE__/*` for local packages (`db`, `config`, `ui`, `jobs`). Never `@techstream/quark-db` etc.
- **Tests** — Co-located `*.test.js`, run with `node --test`.

## Import Patterns

```javascript
// Workspace packages:
import { prisma, user }          from "@__QUARK_SCOPE__/db";
import { loadConfig }            from "@__QUARK_SCOPE__/config";
import { Button, Card, Input }   from "@__QUARK_SCOPE__/ui";
import { JOB_TYPES }             from "@__QUARK_SCOPE__/jobs";

// Published runtime:
import { AppError, ValidationError } from "@techstream/quark-core/errors";
import { createLogger, getCurrentSession, createQueue, addJob } from "@techstream/quark-core";
```

## UI & Design System

Components from `@__QUARK_SCOPE__/ui` — Tailwind-only, Server Component safe:
`Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox`, `Badge`,
`Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`,
`Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`,
`Skeleton`, `Dialog` *(client)*, `Toast`/`useToast` *(client)*.

All accept `className`. Never import from `@/components/ui/*`.

## Standard Patterns

```javascript
// Server Action:
"use server";
const parsed = schema.safeParse(Object.fromEntries(formData));
if (!parsed.success) throw new ValidationError(parsed.error.flatten());
const session = await getCurrentSession();
if (!session) throw new AppError("Unauthorized", 401);

// New env var: register in packages/config/src/validate-env.js first.
// New DB model: schema.prisma → pnpm db:generate → pnpm db:migrate.
// New job: define type in packages/jobs/src/index.js, handler in apps/worker/src/handlers/.
```
