---
"@usequark/quark-create-app": patch
---

Stop writing the Redis password into worker logs.

`waitForRedis` threw `Redis unavailable at ${getRedisUrl()}` when its retries ran
out, and `startWorker` logged `Redis connected` with the same value as the
address. `getRedisUrl()` returns `REDIS_URL` verbatim, so a Railway or managed
Redis URL put the password into the container log and from there into whatever
aggregates it. Both sites now use `getRedisEndpoint()`, which returns
`host:port` with the credentials removed.
