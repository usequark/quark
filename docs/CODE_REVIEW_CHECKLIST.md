# Quark Code Review Checklist

Short gate for every PR. If any box cannot be checked, say so in the PR body.

## 1. No comment or doc asserts unimplemented behaviour

Every assertive verb in a comment or doc (`ensures`, `guarantees`, `always`,
`never`, `rejects`, `requires`) must name behaviour the referenced code
implements at this HEAD.

- [ ] Grepped added/edited comments and docs for assertive verbs and checked each against the referenced file.
- [ ] Numbers with units (limits, TTLs, rounds, ports, budgets) match the code constant, including the scope qualifier (e.g. POST-only, per-route, per-instance).
- [ ] Enumerations are complete: field lists, queue/job names, env vars, routes, status codes, and response bodies match the source (no omitted variant, no removed entry).
- [ ] A doc describing intended-but-missing behaviour is either marked `KNOWN GAP` or filed in the PR body — never written as if it ships.

## 2. No test double for something the schema can produce

Prefer the real shape over a hand-rolled stand-in.

- [ ] New factories/mocks derive from the Prisma schema or the Zod schema, not from a copied literal that can drift.
- [ ] No mock Prisma model/method for a model that exists in `packages/db/prisma/schema.prisma` — use the generated client (or the existing query helper) instead.
- [ ] No mock validation schema duplicating `packages/db/src/schemas.js` — import `passwordSchema` / `userRegisterSchema` / `userUpdateSchema` instead.
- [ ] A double that remains (external service, time, network) documents why the real thing cannot be used in the test.
