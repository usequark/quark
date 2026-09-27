---
"@techstream/quark-core": patch
"@techstream/quark-create-app": patch
---

Make `createQueue()` close-safe and drop dead queue churn from worker preflight.

- `createQueue(name)` now evicts a queue from the singleton registry when it is closed, so the next `createQueue(name)` returns a fresh, usable instance instead of the poisoned, already-closed one. Queues closed through another path are also detected and replaced, and `closeAllQueues()` iterates a snapshot of the registry while close evicts entries.
- The worker `preflight()` health check no longer creates and immediately closes a queue per job queue — that code never used the queue and taught an unsafe pattern by example. Handler registration is now counted directly from the handler registry.
