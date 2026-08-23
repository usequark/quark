---
name: ai
description: Build an AI assistant, chat, or agent on Quark. Use when the user wants AI chat, assistant, agent, streaming, tool calling, or workflows.
---

# AI Skill

Build a user-specific AI assistant on Quark's infrastructure. This skill gives you the domain context, the Quark framework patterns, and the end-result shape. You generate the code that fits the user's exact requirements.

## Context

An AI assistant manages conversations with an LLM, with optional streaming, tool calling, and workflows. The core entities and concerns:

- **Conversation** — a session with a user and the LLM.
- **Message** — a turn in the conversation (user / assistant).
- **Streaming** — stream assistant responses to the client.
- **Tool calling** — tools the assistant can invoke, with a permission/confirm flow.
- **Workflows** — chained steps that record audit events.
- **Context** — conversation history, summarization, compaction.

## Framework context (build on Quark)

- **Models** live in `packages/db/prisma/schema.prisma`. Every model needs `id`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`. After changes: `pnpm db:generate && pnpm db:migrate`.
- **Data access** goes through query helpers in `packages/db/src/queries.js` — never call `prisma.*` directly in pages/actions.
- **API routes** live in `apps/web/src/app/api/ai/`. Guard with `requireRole`, validate with Zod via `validateBody`, wrap mutations in `withCsrfProtection`. Follow `apps/web/src/app/api/ai/conversations/route.js` as the reference shape.
- **Streaming** uses a `chat/stream` route that streams assistant responses.
- **Background jobs** (context extraction, compaction) dispatch via `createQueue`/`addJob` from `@techstream/quark-core` and handle in `apps/worker/src/handlers/`.
- **Chat UI** lives under `apps/web/src/app/admin/ai/` using the neutral admin shell patterns.
- **Auth** via `getCurrentSession` from `@techstream/quark-core`.

## Workflow

1. Read `CLAUDE.md` and `MAIN.md` for project conventions.
2. Clarify the user's requirements: streaming, tool calling, workflows.
3. Design the Prisma models (AiConversation, AiMessage) and add query helpers.
4. Build the conversation CRUD endpoint(s) with auth + Zod validation.
5. Add streaming chat, tool calling (with permission flow), and workflows as required.
6. Add background jobs for context extraction/compaction if required.
7. Add tests near the changed code.

## Example model

```prisma
model AiConversation {
  id        String       @id @default(cuid())
  userId    String
  title     String?
  messages  AiMessage[]
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@index([userId])
}

model AiMessage {
  id             String         @id @default(cuid())
  conversationId String
  conversation   AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           String
  content        String
  createdAt      DateTime       @default(now())
}
```

## Example validation schema

```js
const createMessageSchema = z.object({
  conversationId: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});
```

## Example test pattern

```js
import { test } from "node:test";
import assert from "node:assert";

test("conversation is scoped to its owner", async () => {
  // arrange → act → assert
});
```

## End result

A working AI assistant where users can hold conversations with an LLM, with streaming, tool calling, and workflows as required — with the models, endpoints, jobs, and UI following Quark conventions.

## Reference

A full reference implementation is archived at `reference/verticals/ai/` and `reference/verticals/ai-routes/`. Study it for the complete conversation model, streaming, tool-permission flow, and workflow engine, then adapt to the user's requirements.
