---
"@usequark/quark-create-app": patch
---

`/api/health` now delegates its probing to `@usequark/quark-core/health`.

The route was ~260 lines of orchestration — concurrency, per-probe deadlines,
error normalisation, credential redaction — that every Quark app had ended up
reimplementing or hand-rolling. It is now the thin HTTP shell: it wires the
app's probes into `runHealthChecks()` and renders the report.

The route's existing guarantees are unchanged: every dependency probed
concurrently under its own deadline, always `200` with the verdict in `status`,
generic error messages in production, and `Cache-Control: no-store`. Those
invariants moved into core and are covered by `health.test.js`; the route tests
now cover the wiring, which is what the route is still responsible for.

`checkStorage()` keeps the sentinel write/delete round-trip rather than a
`stat`: `stat` only proves a path exists and cannot distinguish a read-only
mount from a writable one, which is the only failure the probe exists to catch.
The round-trip also works unchanged for S3/R2, where a filesystem permission
check means nothing.