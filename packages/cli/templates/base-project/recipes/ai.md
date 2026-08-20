---
name: Add an AI assistant
feature: ai
files:
  - packages/db/prisma/ai.prisma
  - apps/web/src/app/api/ai/route.js
  - apps/web/src/app/api/ai/[id]/route.js
depends: [db]
---

## What this builds

A generic AI assistant: `AiConversation` and `AiMessage` models plus a CRUD endpoint for conversations. This is a lean starting point — you extend it with streaming, tool calling, and permissions as your product needs them.

## Files created

| File | Purpose |
|------|---------|
| `packages/db/prisma/ai.prisma` | Generic `AiConversation` / `AiMessage` models (merge into `schema.prisma`) |
| `apps/web/src/app/api/ai/route.js` | `GET` (list) + `POST` (create) |
| `apps/web/src/app/api/ai/[id]/route.js` | `GET` (read) + `PATCH` (update) + `DELETE` (soft) |

## Patterns to follow

- Merge `ai.prisma` into `packages/db/prisma/schema.prisma`, then `pnpm db:generate && pnpm db:migrate`.
- Every model includes `id`, `createdAt DateTime @default(now())`, and `updatedAt DateTime @updatedAt`.
- Guard with `requireRole`, validate with Zod via `validateBody`, wrap mutations in `withCsrfProtection`.
- Use query helpers in `packages/db/src/queries.js` — do not call `prisma.*` directly in pages.
- Follow the existing `apps/web/src/app/api/ai/conversations/route.js` as reference.

## Extension path

The generic starter covers the core. To build a real AI assistant, extend with:

- **Streaming chat** — add a `chat/stream` route that streams assistant responses (see `apps/web/src/app/api/ai/chat/stream/`).
- **Tool calling** — add tool definitions, a tool-permission model, and a confirm/deny flow.
- **Workflows** — add a workflow engine that chains steps and records audit events.
- **Chat UI** — add a conversation UI under `apps/web/src/app/admin/ai/`.

## Prompt to paste

```text
Build the AI assistant described in recipes/ai.md.

Read CLAUDE.md first, then:
1. Merge packages/db/prisma/ai.prisma into schema.prisma and migrate.
2. Add query helpers for AiConversation and AiMessage to packages/db/src/queries.js.
3. Wire up the CRUD endpoint at apps/web/src/app/api/ai/.
4. Extend with streaming, tool calling, and permissions per the extension path.
5. Add a test near the changed code.
```
