# ADR-003: Prisma as the ORM

**Status:** Accepted  
**Date:** 2024-01

## Context

Quark needs a database access layer that works well with PostgreSQL, supports migrations, and is approachable for developers who are not SQL experts. Options considered: raw SQL (pg/postgres.js), Drizzle ORM, Prisma, and Knex.

Key requirements:
- Schema-as-code with migration management
- Type-safe queries (even in plain JS via generated client)
- Good Next.js / edge-compatible ergonomics
- Active ecosystem and documentation

## Decision

Prisma is the ORM for Quark. The schema lives in `packages/db/prisma/schema.prisma`, migrations run via `pnpm db:migrate`, and queries are encapsulated in `packages/db/src/queries.js`.

The Prisma client is generated into `packages/db/node_modules/.prisma/` and imported via `@usequark/quark-db`.

## Consequences

**Positive:**
- Declarative schema with automatic migration history tracking
- Generated client provides autocomplete and query validation even in plain JS
- First-class support for PostgreSQL features (enums, JSON, relations)
- `prisma studio` provides a zero-config database GUI during development

**Negative:**
- Prisma adds a code-generation step (`pnpm db:generate`) that must run after schema changes
- The generated client is heavy; not suitable for edge runtimes (Lambda@Edge, Cloudflare Workers)
- Schema changes that affect published packages (`@usequark/quark-db`) require a versioned release
