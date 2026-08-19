---
name: Recipe name
feature: feature-key
files:
  - path/to/file/one.js
  - path/to/file/two.prisma
depends: [db, admin]
---

## What this builds

One or two sentences describing the feature this recipe produces and the problem it solves.

## Files created

| File | Purpose |
|------|---------|
| `path/to/file/one.js` | What this file does |
| `path/to/file/two.prisma` | What this file does |

## Patterns to follow

- **ESM only** — `import`/`export` everywhere. Never `require()`.
- **No authored TypeScript** — `.js`/`.jsx` only.
- **Errors** — use `AppError` / `ValidationError` from `@techstream/quark-core/errors`, never `throw new Error()`.
- **Logging** — use `createLogger(name)` from `@techstream/quark-core`, never `console.log`.
- **Validation** — every Server Action and API route validates with Zod.
- **Prisma models** — include `id`, `createdAt DateTime @default(now())`, and `updatedAt DateTime @updatedAt`.
- **Query helpers** — do not call `prisma.*` directly in pages/actions; add helpers to `packages/db/src/queries.js`.

## Prompt to paste

```text
Build the <feature> described in recipes/<feature>.md.

Read CLAUDE.md first, then:
1. Create the files listed in the recipe's frontmatter.
2. Follow the patterns above.
3. Run pnpm db:generate and pnpm db:migrate after any schema change.
4. Add a test near the changed code.
```
