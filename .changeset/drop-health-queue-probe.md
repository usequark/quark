---
"@usequark/quark-create-app": patch
---

Stop `/api/health` from probing queues, and correct the memory figure from #259

**The probe was always empty, and it cost ~14 MB on the hottest path in the app.**

`/api/health` passed `queues: () => checkQueues(getRegisteredQueues)` into
`runHealthChecks`. `getRegisteredQueues()` returns a Map of queues registered
*in this process*, and the web service registers none — the worker owns every
long-lived queue. So `checkQueues` returned `null` and no `checks.queues` key was
ever emitted from the web process.

Reaching `getRegisteredQueues` at all meant importing `@usequark/quark-core/queue`,
which statically imports BullMQ. That route is polled by the Railway platform
healthcheck and by `<HealthIndicator />` on every visitor page load, making it the
worst possible place to load a queue library for a result that is always empty.

Queue depth is not lost: the worker already publishes it as the `job_queue_depth`
gauge (`updateQueueDepths()` in `apps/worker/src/index.js`, every 30s).

**This also corrects a false claim in #259's changelog.** That entry — now shipped
in `@usequark/quark-core@2.6.3` — states the health response "no longer carries a
`checks.queues` key". It did. A rebase against upstream's `/health` refactor
restored the import without the rebase being checked against what the subpath
exports, so the claim was untrue as published. This change makes it true.

The same entry's **"roughly 60 MB of RSS" is also wrong.** Measured on Node 24,
three runs each, after an explicit GC:

| Import | RSS | bullmq modules | msgpackr |
|---|---|---|---|
| `@usequark/quark-core` (barrel) | 76.9–77.2 MB | 150 | 4 |
| narrow subpaths | 62.3–62.5 MB | 0 | 0 |

The real saving is **~14 MB**, not 60 MB — roughly $1.70/month per web service at
Railway's $10/GB-month, not ~$7.20. The mechanism is real and was verified: the
150 BullMQ modules do go to zero. Only the headline number was never measured.

**Behaviour change:** `GET /api/health` no longer emits a `checks.queues` key. In
a scaffolded app it never emitted one, because the web process registers no
queues. A project that registers queues *in the web process* would lose the key —
use the worker's `job_queue_depth` instead.

Verified: `quark-web` 314/314, full suite 9/9, lint clean,
`sync-templates:check` in sync, `pnpm --filter @usequark/quark-web build` succeeds,
and a static reachability scan confirms neither the barrel nor `/queue` is
reachable from `/api/health`.