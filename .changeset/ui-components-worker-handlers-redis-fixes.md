---
"@techstream/quark-core": patch
"@techstream/quark-create-app": minor
---

## @techstream/quark-create-app

### UI Component Library — scaffolded projects now include a full component set

New projects scaffolded with `create-quark-app` now include a complete `ui` package with all core primitives and their tests:

- `Textarea`, `Badge`, `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`
- `Checkbox`, `Dialog` (client), `Input`, `Label`, `Select`, `Skeleton`
- `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`
- `Toast`/`useToast` (client)
- Theme constants and theme utilities

### Worker — email and file job handlers included by default

The scaffolded `worker` package now ships with ready-to-use job handlers:

- `handlers/email.js` — handles `sendEmail` jobs via the core email service
- `handlers/files.js` — handles `processFile` jobs
- `handlers/index.js` — handler registry
- Full test coverage for all handlers

### AI tool conventions baked into scaffolded projects

New projects include pre-configured AI tool integration files: `CLAUDE.md`, `.cursor/rules/quark.mdc`, `SKILL.md`, and `copilot-instructions.md` with Quark-specific conventions matching the monorepo standards.

---

## @techstream/quark-core

### Fixes

- `throttledError` in Redis utilities now logs as **warnings** instead of errors to reduce noise for expected transient failures
- `waitForRedis` error messages improved for clarity
- Export ordering in `mail.js` corrected

### Refactors

- Redis error handling streamlined (`redis.js`, `queue/index.js`) — no breaking API changes
