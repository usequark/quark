---
"@usequark/quark-core": patch
---

docs: correct false claims about rate limiting, core db code, and the worker

An adversarial review found docs asserting behaviour the code does not have.
Every claim below was re-verified against the source at current HEAD before it
was changed. No code changed.

- `docs/SECURITY_FEATURES.md`, `docs/ARCHITECTURE.md`: rate limiting is
  in-memory only in the shipped path. `apps/web/src/proxy.js` never reads
  `REDIS_URL`; `apps/web/src/proxy.redis.js` is imported only by its own test.
  `createRateLimiter({ type: "redis", redisClient })` exists in core but nothing
  wires it into the web middleware. Claims that `REDIS_URL` switches the
  middleware to Redis are removed and the Redis limiter is labelled as an
  unwired building block.
- `docs/SECURITY_FEATURES.md`: `X-XSS-Protection` is not set by either
  `proxy.js` or `next.config.js`; the applied CSP directive is documented
  instead. Raw-SQL claim narrowed to the constant health probes that exist.
- `docs/SECURITY_FEATURES.md`: dependabot auto-merge ships as a workflow, not
  as `.github/dependabot-auto-merge.yml`.
- `docs/ARCHITECTURE.md`: core ships database code (`db.js`,
  `db-instrumentation.js`, `db-metrics.js` plus a `./db` subpath export).
  "Core has NO database code" is corrected to "no database client, no Prisma
  dependency". Subpath export count 18 → 21.
- `docs/ARCHITECTURE.md`: design tokens live in `:root`, not in the
  `@theme inline` block, and the quoted `oklch(...)` values do not appear in
  `globals.css`.
- `apps/worker/README.md`: `WORKER_MAX_FAILURES`, `WORKER_SHUTDOWN_TIMEOUT_MS`,
  `REDIS_PASSWORD`, and `REDIS_TLS_*` are read by no code. Removed the
  dead-letter queue claim, the "centralized error reporter" claim, the 30s
  per-job timeout claim, and the `DEBUG=*` tip (the logger reads `LOG_LEVEL`).
- `apps/worker/README.md`: job retry defaults live in `createQueue` in core,
  not in `@usequark/quark-jobs`, and `removeOnComplete` is
  `{ age: 60, count: 100 }`, not `true`.
- `apps/worker/README.md`: the "complete example" used an `emailService.send()`
  API that does not exist (`createEmailService()` + `sendEmail(to, subject,
  html, text)`) and cited `src/handlers/email.test.js`, which does not exist.
- `README.md`: rate limiting and `X-XSS-Protection` security-feature bullets
  corrected. `mobile` moved out of the create-time optional-package list.
- `packages/core/README.md`: the subpath table claimed to list every export
  but omitted `csrf-client`, `email-templates`, `multipart`, and `redis`;
  "all modules are re-exported from the package root" is not true of `locale`,
  `stripe`, `storage-s3`, `csrf-client`, and `testing`.

No published-package behaviour changes.
