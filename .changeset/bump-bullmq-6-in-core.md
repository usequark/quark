---
"@techstream/quark-core": patch
---

Bump bullmq to v6

The queue module no longer reaches for BullMQ's removed public `queue.client`
getter; deduplication uses BullMQ's native `deduplication` option and
`checkQueueHealth` uses `waitUntilReady()`. See 740707b for the behavioural
detail. Split out of dependabot #137 for individual review.
