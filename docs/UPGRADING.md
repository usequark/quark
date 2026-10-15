# Upgrading Quark

Migration notes for behaviour changes in the published packages
(`@usequark/quark-core`, `@usequark/quark-create-app`). Read this before
upgrading across any minor or major bump.

The rule that decides the bump lives in
[CONTRIBUTING.md](../CONTRIBUTING.md) ("Versioning and release policy") —
that is the canonical policy; this file is its per-release consequence. Every
minor or major behaviour change must add an entry here (an `Unreleased`
entry while it is pending, moved under its version on release) alongside
its changeset. Patch releases are docs/tests only and never appear here.

Headings carry the release date where it is known (`## 2.8.0 - 2026-10-11`).
Older CHANGELOG headings predate dated releases and stay undated; their
entries below give the version but no invented date.

## Unreleased — Wave-1 (pending release)

Merged to `main` behind changesets but not yet versioned. Treat this as the
migration checklist for the next release.

### Mobile refresh tokens are re-validated against the database (pending, minor)

`POST /api/auth/refresh` re-derives identity and role from the database on
every exchange (`userQueries.findById(payload.sub)` in
`apps/web/src/app/api/auth/refresh/route.js`):

- Unknown account (deleted between issue and exchange) → refresh rejected.
- `passwordChangedAt` after the token's `iat` → rejected, so a password
  reset kills live refresh tokens (mirrors the web session revocation model).
- Role, email, and name come from the row, never from the token — profile
  changes apply immediately instead of lingering for the token's lifetime.

Migration: none required unless you relied on stale claims surviving a
profile change. After upgrade, refresh tokens for deleted, demoted, or
password-reset accounts stop minting access tokens — that is the fix, not a
regression. Mobile clients need no change; the next refresh simply
re-authenticates or fails closed.

### `TRUST_PROXY_HEADERS` gates proxy-header trust (pending, minor)

The scaffolded `apps/web/src/proxy.js` keyed rate-limit buckets on the
left-most `x-forwarded-for` entry unconditionally, so a directly-reachable
app let any client mint a fresh bucket per request with a spoofed header.
`TRUST_PROXY_HEADERS` now gates that trust (`shouldTrustProxyHeaders()`).

Migration: none required. The default (unset) preserves today's behaviour —
headers trusted, correct behind a reverse proxy (Railway, Docker, nginx)
that overwrites them. Only set `TRUST_PROXY_HEADERS=false` if the app is
reachable without such a proxy. Note the trade-off: with trust off, every
client keys on the literal `"unknown"`, so each route shares one bucket
across all its clients and a single client's burst can exhaust the bucket
for that route. Only explicit false-like values (`false`, `0`, `no`, `off`)
disable trust; anything else keeps the default. Buckets are per
`<client-ip>:<path>`, so one flooded path never affects other routes.

### `REQUIRE_EMAIL_VERIFICATION` defaults to `true` (pending, minor)

One flag governs every sign-in path: the credentials `authorize()` in
`apps/web/src/lib/auth.js` now refuses an account with no `emailVerified`
on file with the same `OAUTH_EMAIL_NOT_VERIFIED` `AppError` (401) the
Google provider mapper throws, and the mobile `POST /api/auth/google` and
`POST /api/auth/apple` routes read the same flag. `null`/unset reads as
unverified, and the password is still checked first so the refusal cannot
become an account-enumeration oracle. Set
`REQUIRE_EMAIL_VERIFICATION=false` to restore the pre-gate behaviour on
every path at once.

Migration: registration has never set `emailVerified`, and neither does the
seed — so with the default on, every existing credentials account that never
redeemed a verification link is refused sign-in after upgrade (and OAuth
accounts whose provider reports an unconfirmed address too). Before
deploying, either confirm the installed base, tell users to request a fresh
verification link, backfill `emailVerified` for known-good addresses, or ship
with `REQUIRE_EMAIL_VERIFICATION=false` and flip it once the backlog is
verified.

### `update --scaffold-check` is scoped by installed feature (pending, minor)

`add mobile` appends the mobile block (`# --- Mobile App ---` /
`EXPO_PUBLIC_API_URL`) to the scaffold-managed root `.env.example`, but
`create` rejects `mobile`, so the reference scaffold the check rebuilt could
never carry it — every mobile project failed
`update --scaffold-check --fail-on-drift` with a false positive. The
reference scaffold now replays those constant mobile edits when `mobile` is
recorded in `.quark-link.json`.

Migration: none required. A mobile project that failed only on this false
positive passes once it updates `@usequark/quark-create-app`; projects with
genuine drift are unaffected, and editing or deleting the mobile block is
still reported.

## `@usequark/quark-core` — major 2 (current)

### 2.7.0 — rate limiter fails closed; Redis wiring in the shipped proxy

Two audit findings, fixed together:

- `RedisRateLimiter` defaulted to `failOpen: true`: a Redis error
  mid-request returned "not limited" for every request. The default is now
  fail closed (Redis error → request treated as rate-limited). Opt back in
  only deliberately with `failOpen: true`.
- The Redis limiter was written but never connected: `apps/web/src/proxy.js`
  hardcoded an in-memory `Map`. It now selects its backend from `REDIS_URL`
  (set → one shared Redis-backed limiter; unset → in-memory, which loses
  Redis at runtime degrades to rather than dropping limiting entirely).
  `proxy.redis.js` and its test were deleted — that capability lives in the
  one proxy that ships.

Migration: if you constructed `RedisRateLimiter` without options you are
now fail-closed; pass `failOpen: true` explicitly if outage-driven 429s are
worse for you than attacker-driven floods. If you carried a local copy of
`proxy.redis.js`, delete it and set `REDIS_URL` instead.

### 2.6.2 — `/api/auth/` CSRF exemption removed

`requireCsrfToken` skipped every path under `/api/auth/` (written for
NextAuth's `[...nextauth]` catch-all, which never reaches the check anyway).
That silently disarmed `withCsrfProtection` on every hand-written route in
the prefix — including `/api/auth/register`, which accepted cookie-bearing
cross-site POSTs. The check now skips only safe methods (`GET`, `HEAD`,
`OPTIONS`) and `Bearer`-authenticated requests; no path is exempt by name.

Migration: any consumer wrapping a route under `/api/auth/` in
`withCsrfProtection` previously passed unchecked and now receives `401`
unless it carries a matching `csrf_token` cookie and `x-csrf-token` header.
Obtain a token from `GET /api/csrf` first (`getCsrfToken()` in
`@usequark/quark-core/csrf-client` is safe to call before sign-in). Safe
methods and `Bearer` requests are unaffected.

## `@usequark/quark-core` — major 1 (historical)

No migration notes were recorded for 1.x. New entries go under the current
major above; this section exists so the skeleton is complete.

## `@usequark/quark-core` — major 3 (not yet released)

Placeholder. The first behaviour change slated for 3.x gets its entry here.

## `@usequark/quark-create-app` — major 1 (current)

Scaffold behaviour changes ship here; pending ones are listed under
Unreleased above and move under their versioned heading on release with
their release date. No separately versioned migration notes predate Wave-1.

## `@usequark/quark-create-app` — major 2 (not yet released)

Placeholder. The first breaking scaffold change gets its entry here.
