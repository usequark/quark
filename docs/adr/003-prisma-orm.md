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

The generator's `output` is `../src/generated/prisma`, so the client is generated into `packages/db/src/generated/prisma/` and imported as `./generated/prisma/client.js` inside the db package. In a scaffolded project the package is `@<scope>/db`, not a published `@usequark/*` package.

## Consequences

**Positive:**
- Declarative schema with automatic migration history tracking
- Generated client provides autocomplete and query validation even in plain JS
- First-class support for PostgreSQL features (enums, JSON, relations)
- `prisma studio` provides a zero-config database GUI during development

**Negative:**
- Prisma adds a code-generation step (`pnpm db:generate`) that must run after schema changes
- The generated client is heavy; not suitable for edge runtimes (Lambda@Edge, Cloudflare Workers)
- The db package is scaffolded, not published, so a user's project needs no release when its schema changes. Only schema-affecting changes to `@usequark/quark-core` require one
- The schema ships 7 core models and 2 enums. Domain verticals are added by the user or by an AI agent following the `add-model` skill
