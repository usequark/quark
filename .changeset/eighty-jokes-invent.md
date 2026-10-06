---
"@usequark/quark-core": minor
---

Add a reusable health-check module, and fix a credential leak in `redactUrl()`.

**New: `@usequark/quark-core/health`**

`runHealthChecks()` holds two invariants that every Quark app was
reimplementing:

- *The aggregate completes inside one overall deadline.* Probes run
  concurrently, each under its own deadline clamped to the overall budget.
  Sequentially, three 3s probes exhaust a 5s budget before the last one starts —
  and an exhausted budget reads as a dead service.
- *No message leaves carrying a credential.* Both failure shapes are normalised
  in one place: a probe can report failure by rejecting **or** by resolving with
  `{ status: "error", message }`. Handling only rejections is what let
  `pingRedis` publish the Redis password from an unauthenticated endpoint once.

Also exports `checkStorage()`, `checkQueues()`, `isFailing()` and
`createDefaultProbes()`. `pingDatabase` is passed in rather than imported,
because `@usequark/quark-db` depends on this package and importing it back
would be circular.

**Fix: `redactUrl()` missed credentials in a URL embedded mid-message.**

This is the more important half. The old fallback regex was anchored to the
start of the string, so it only redacted a *bare* URL. Drivers do not report
bare URLs — they report the connection string inside a longer message:

```
connect ECONNREFUSED redis://default:hunter2@cache.internal:6379
```

That string does not parse as a URL, so it fell to the regex, which did not
match, and **the password was returned intact**. The docstring already claimed
the function was for "nothing that embeds a URL in a message should skip this",
which is exactly the case it did not handle.

Now every URL-shaped substring is scanned wherever it sits. Added tests for the
embedded, multi-URL, and embedded-but-credential-free cases.