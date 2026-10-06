---
"@usequark/quark-create-app": minor
---

Stop the healthcheck from being the thing that kills the service, and stop it
publishing credentials.

`/api/health` is the platform healthcheck, and it had three independent ways to
make an orchestrator restart a container that was otherwise fine.

**Probes ran one after another, under a deadline the first two probes could
exhaust.** Database, Redis, storage, and queues were awaited in sequence. Each of
the first two carries its own 3s timeout, so a database that was slow to refuse
plus a Redis that was slow to refuse spent the whole 5s budget before storage was
even attempted. The outer timer then fired, the route returned **500**, and the
container restarted — dropping every warm connection and producing a fresh
connection storm on the dependency that was already struggling. The same held
when a probe never settled at all. All probes now run concurrently, each under
its own deadline capped by the overall budget, so the aggregate completes inside
the budget no matter which dependency is slow.

**The route returned 500 when it ran out of time.** It now always answers **200**
and reports the verdict in the body's `status` field (`ok` / `degraded`), plus a
`durationMs` and a `Cache-Control: no-store`. Callers that need a hard verdict
should read `status`, not the status code. Note this makes a fully degraded
instance still report healthy to the orchestrator; splitting liveness from
readiness is the real fix and is deliberately out of scope here.

**The healthcheck was rate limited.** `/api/health` fell into the 100-request
`api` bucket, so a probe arriving in a full bucket got a **429** — which the
orchestrator also reads as unhealthy. `/api/health` is now exempt from rate
limiting entirely: no counter, no `X-RateLimit-*` headers.

Separately, on the credential path: error messages are now redacted in
production before they leave the route. A probe can report failure by rejecting
*or* by resolving with `{ status: "error", message }`, and the old
`pingRedis` took the second route — so normalising only rejections would still
have published the Redis password. `pingRedis` no longer includes it in the
first place (see the `@usequark/quark-core` changelog), and the route is the
second layer.
