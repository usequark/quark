---
"@usequark/quark-core": minor
"@usequark/quark-create-app": patch
---

Wire the Redis rate limiter into the shipped proxy and make rate limiting fail closed.

Two audit findings, fixed together because they are the same component:

**Item 7 — the limiter failed open.** `RedisRateLimiter` defaulted to
`failOpen: true`: when Redis errored mid-request the limiter returned
"not limited" for every request. A limiter that allows traffic through the
moment it is unreachable is no limiter exactly when it matters — Redis
erroring under load is the signature of the attack it was supposed to
absorb. The default is now **fail closed** (Redis error → treat the request
as rate-limited). Callers who genuinely prefer outage-driven 429s over
attacker-driven floods can still opt in with `failOpen: true`; the option
is unchanged, only its default.

**Item 9 — the Redis limiter was written but never connected.**
`apps/web/src/proxy.js` hardcoded an in-memory `Map` regardless of
configuration, while `proxy.redis.js` (a full duplicate proxy) was imported
by nothing but its own test. `proxy.js` now selects its backend from
`REDIS_URL`: set → one shared Redis-backed limiter (correct for
multi-instance deployments); unset → in-memory (correct for a single
instance). Losing Redis at runtime degrades to in-memory counters rather
than dropping rate limiting entirely. `proxy.redis.js` and its test are
deleted — the capability they duplicated now lives in the one proxy that
actually ships. `docs/SECURITY_FEATURES.md` updated: the Redis section now
describes the real env-var switch instead of the manual file-swap recipe.

New tests pin all of it: fail-closed and explicit fail-open at the core
layer, backend selection and Redis-error behavior at the proxy layer.
