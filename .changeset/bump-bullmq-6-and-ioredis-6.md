---
"@techstream/quark-create-app": patch
---

Bump bullmq to v6 and ioredis to v6

Both majors were split out of dependabot's 35-package PR for individual review.

- **bullmq 5.70.4 -> 6.3.8.** v6 removed the public `queue.client` getter.
  The queue module no longer reaches for it: deduplication uses BullMQ's own
  `deduplication` job option and `checkQueueHealth` uses `waitUntilReady()`.
  Verified 547/547 core tests on 5.70.4 and on 6.3.9.
- **ioredis 5.10.0 -> 6.0.0.** v6 requires Node >= 20 (this repo requires
  >= 22) and defaults to RESP3. The only commands Quark issues are `PING` and
  a single `EVAL` returning `{count, ttl}`, whose result shape is identical
  under RESP2 and RESP3. Verified against live Redis: the Redis rate limiter
  still returns correct `limited`/`remaining`/`resetTime` values.

Scaffold templates re-synced to match.
