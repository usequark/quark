---
"@techstream/quark-core": patch
---

Use BullMQ's public APIs for job deduplication and health checks

`addJob`'s deduplication was hand-rolled with a raw `SET NX` against
`queue.client`, a BullMQ internal that v6 removed. The `SET NX` then threw, a
best-effort `catch` swallowed the error, and every "deduplicated" job was
enqueued anyway - silently, with only a WARN in the logs. Deduplication now maps
`dedupKey`/`dedupTTL` onto BullMQ's own `deduplication` job option, which has
existed since v5 and matches the documented return contract (a duplicate
resolves to the already-queued job).

`checkQueueHealth` used the same removed getter to ping Redis, so on v6 it
reported a healthy Redis as unavailable and worker preflight would fail. It now
uses `waitUntilReady()`, the supported readiness primitive, which behaves the
same on v5 and v6.

Neither change alters behaviour on the pinned bullmq 5: verified 547/547 core
tests pass on 5.70.4, and on 6.3.9 the fix passes where the previous code fails
the close-safety test and silently loses deduplication.
