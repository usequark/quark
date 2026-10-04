# ADR-005: BullMQ for Background Jobs

**Status:** Accepted  
**Date:** 2024-01

## Context

Production applications need a reliable mechanism for background processing: sending emails asynchronously, processing uploaded files, running scheduled tasks, and handling work that should not block HTTP responses.

Options considered: pg-boss (Postgres-backed), Agenda (MongoDB), BullMQ (Redis-backed), and simple in-process setTimeout queuing.

Key requirements:
- Reliable delivery with retry and back-off
- Job deduplication
- Priority queues
- Observable (metrics, job status, failure tracking)
- Runnable alongside a Next.js app without infrastructure changes

## Decision

BullMQ is the job queue for Quark. Jobs are defined in `packages/jobs/src/`, enqueued from Next.js Server Actions or API routes using `@usequark/quark-core`'s job helpers, and processed by the `apps/worker` BullMQ worker process.

Redis (already required for session caching) serves as the BullMQ backend, so no additional infrastructure is needed.

## Consequences

**Positive:**
- Battle-tested queue with retries, exponential back-off, and dead-letter support
- Built-in metrics hooks integrate with Quark's `metrics` singleton
- Job types in `packages/jobs` are shared between the web app and worker - no duplication
- Redis is already in the stack (session caching), so no new infrastructure cost

**Negative:**
- Requires Redis in all environments (local dev, CI, staging, production)
- BullMQ v5+ has breaking changes from v4 - upgrades require care
- Worker process must be deployed and scaled separately from the web app
