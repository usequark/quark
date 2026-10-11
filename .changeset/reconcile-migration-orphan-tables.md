---
"@usequark/quark-create-app": patch
---

Reconcile migration history with the 7-model schema; drop four redundant indexes.

The monorepo's migration log created 15 domain-vertical tables (CMS, CRM,
AI, bookings) that were later deleted from `schema.prisma` but never from
the migration history. `migrate deploy` therefore materialised them on every
database, and the next `migrate dev` would have emitted destructive,
machine-local drops — the review's "migration landmine". A new migration
(`20261011000000_reconcile_orphan_tables_and_indexes`) drops all 15 tables
plus their three orphan enums (`AiRole`, `BookingStatus`, `ContentStatus`),
guarded with `IF EXISTS`, and is verified against both a fresh database and
one replayed to the pre-reconciliation state. After it, `migrate diff
--from-migrations --to-schema` is empty: history and schema agree exactly.

Also removes four indexes that duplicated other indexes the same schema
declared: `User_email_idx` and `VerificationToken_token_idx` duplicate
unique constraints on the same columns, and `Job_status_idx`/`Job_runAt_idx`
are leftmost-prefix subsumed by `Job_status_runAt_idx`. The template's
squashed initial migration is regenerated to match, so newly scaffolded
projects carry neither the redundant indexes nor any orphan table (they
never shipped the monorepo history — this fix touches only databases
deployed from the monorepo log).
