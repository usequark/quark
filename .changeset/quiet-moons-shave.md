---
"@usequark/quark-core": patch
---

Stop `pingRedis` from putting a Redis password in a message that is served
publicly.

On a connection failure, `pingRedis` returned
`Redis unreachable at ${getRedisUrl()}` — and `getRedisUrl()` returns `REDIS_URL`
verbatim, credentials included. The scaffolded `/api/health` route copies that
message straight into its JSON response, and the route has no auth. With
`REDIS_URL=redis://default:hunter2@cache.internal:6379`, an unauthenticated
`GET /api/health` returned the Redis password.

`pingDatabase` already disclosed only `hostname:port`. `pingRedis` now matches
it, via a new `getRedisEndpoint()` that returns `host:port` with every
credential removed — `cache.internal:6379`, defaulting the port to 6379 (6380 for
`rediss://`), and falling back to a redacted form if `REDIS_URL` cannot be
parsed. `getRedisUrl()` is unchanged and still returns the working connection
string for callers that need to connect.

Also adds `redactUrl(value)` to the core barrel: strips the username and
password from any URL, for callers that need to embed one in a message.
