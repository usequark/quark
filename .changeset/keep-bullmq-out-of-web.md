---
"@usequark/quark-core": patch
"@usequark/quark-create-app": patch
---

perf(core): keep BullMQ out of the web process via narrow subpath imports

The `@usequark/quark-core` barrel re-exports 27 modules, one of which
statically imports BullMQ. A route that imported the barrel for a single
symbol — `validateBody`, `createLogger` — pulled BullMQ, ioredis and msgpackr
into that route's module graph. Measured on Node 24, importing the barrel
costs roughly 60 MB of RSS before doing any work, almost all of it BullMQ. A
web service holding that for its lifetime is a direct Railway memory charge
at $10/GB-month.

This does not change the barrel. It stops the framework's own routes from
needing it.

**Three additive subpaths** cover the symbols that previously had no narrow
entry point, so callers no longer have to reach for the barrel to get them:

- `./redis` — `resolveRedisConnection`, `pingRedis`, `getRedisUrl`
- `./multipart` — `parseMultipart`
- `./email-templates` — `welcomeEmail`, `passwordResetEmail`

The existing exports map is unchanged and the barrel still re-exports
everything it always did, including `./queue/index.js`. Removing that
re-export would break any consumer importing `createQueue` from the barrel,
so it stays.

**Every internal call site in `apps/web` and `apps/worker` now imports a
narrow subpath** — 29 files, plus the 3 in `packages/config` and
`packages/db`. No file in either app imports the barrel at module scope
anymore.

Two routes needed more than a mechanical rewrite because importing the queue
module there would have moved the cost onto the worst possible path:

`/api/health` previously called `getRegisteredQueues` to report queue depths.
This endpoint is polled by the Railway healthcheck and by
`<HealthIndicator />` on every page view, so importing the queue module here
loads BullMQ on the hottest path in the app — the exact regression this
change exists to prevent. Queue introspection now belongs to the worker, and
`/api/metrics` is the place to read queue depth. The health response no
longer carries a `checks.queues` key.

`/api/auth/register` previously imported `createQueue` at module scope, which
both loaded BullMQ at startup and permanently attached a Redis connection to
the web process on the first successful registration. The queue module is
now a dynamic import inside the handler, and the `Queue` is closed once the
job is added, so the connection is released rather than held for the
lifetime of the process. The job is already persisted in Redis by then, so
closing is safe. A failed enqueue still does not block account creation.

`health/route.test.js` mocked the barrel; its mocks are now scoped to the
three subpaths the route actually imports, and it no longer stubs
`getRegisteredQueues`.

The `@usequark/quark-create-app` bump ships the equivalent template changes,
so newly scaffolded projects start with the narrow imports rather than
inheriting the barrel.

Also fixes a Biome 2.x config error that made `pnpm lint` exit non-zero on
every run: `linter.rules.preset` is not a known key, the group is
`linter.rules.recommended`. This was pre-existing and unrelated; it is
included because the lint gate could not pass without it.
