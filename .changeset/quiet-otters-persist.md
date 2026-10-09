---
"@usequark/quark-create-app": patch
---

Declare the Postgres and Redis databases in the generated `.railway/railway.ts`, so a second `quark deploy railway` no longer plans to delete them.

`generateIacFile()` emitted `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` references but never declared the resources they point at. Railway treats an omitted resource in a whole-project file as absent, and absent means delete — so the second apply of every scaffolded project planned to destroy the databases the first one created.

The scaffold template `packages/cli/templates/base-project/.railway/railway.ts` carried the same omission, and is updated to match. A test now fails if a generated file references a database without declaring it.
