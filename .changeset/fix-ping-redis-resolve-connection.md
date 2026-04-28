---
"@techstream/quark-core": patch
---

Fix `pingRedis` to use `resolveRedisConnection()` instead of a raw `getRedisUrl()` string.

Previously, `pingRedis` called `new Redis(url, options)` with the URL string from `getRedisUrl()`, which bypassed the structured `resolveRedisConnection()` path that correctly handles `REDIS_HOST`/`REDIS_PORT`, password decoding, and TLS (`rediss://`). The fix uses the same options-object form as the rest of the queue module.
