---
"@usequark/quark-create-app": patch
---

Fix a crash on worker startup in every fresh scaffold.

`startWorker()` called `waitForDatabase(config)` when the signature is
`(healthCheck, config)`, so the config object landed in the `healthCheck` slot
and every call threw `TypeError: healthCheck is not a function`.

Worse than a crash loop: a `TypeError` is classified as neither a schema nor a
connection error, so it rethrew on attempt 1 as
`DATABASE_HEALTH_CHECK_FAILED` and the dev retry config never applied. The
sibling call to `waitForRedis` was already correct.

The call now passes `undefined` first so the default health check applies, and
both `waitForDatabase` and `waitForRedis` reject a non-function health check up
front with a named `AppError` instead of an opaque `TypeError`.

The unit tests missed this because they call `waitForDatabase` directly with a
function — `startWorker()` was never exercised. Added a test that asserts the
shape of the real call sites in `startWorker()`, verified to fail when the
original call is restored.