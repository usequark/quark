---
"@usequark/quark-create-app": patch
---

Correct the Job index comment in the scaffolded Prisma schema: the `(status, runAt)` compound index does not index `runAt` alone, so a `runAt`-only range query would still need its own index. Comment-only change; no schema or migration is affected.
