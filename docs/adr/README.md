# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Quark framework.

An ADR documents a significant architectural decision: the context, the decision made, and its consequences.

## Index

| ID | Title | Status |
|----|-------|--------|
| [ADR-001](./001-esm-only.md) | ESM-only, No CommonJS | Accepted |
| [ADR-002](./002-no-typescript.md) | No TypeScript - Plain JavaScript | Accepted |
| [ADR-003](./003-prisma-orm.md) | Prisma as the ORM | Accepted |
| [ADR-004](./004-tailwind-ui-primitives.md) | Tailwind-only UI Primitives (No Shadcn) | Accepted |
| [ADR-005](./005-bullmq-job-queue.md) | BullMQ for Background Jobs | Accepted |

## Format

Each ADR uses this structure:

- **Status:** Accepted / Superseded / Deprecated
- **Context:** Why a decision was needed
- **Decision:** What was decided
- **Consequences:** Trade-offs and implications
