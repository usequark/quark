---
---

chore(worker): drop the unused `getRedisUrl` import

Repointing the worker onto narrow subpath imports split the old barrel
import and carried `getRedisUrl` along with it, but the worker only ever
called `getRedisEndpoint`. Biome flagged it on every lint run; `pnpm lint`
still exited 0, so it was easy to miss.

No published-package behaviour changes.