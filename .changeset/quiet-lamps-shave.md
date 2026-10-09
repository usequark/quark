---
"@usequark/quark-core": patch
---

Add `getCsrfToken()` / `clearCsrfToken()`, and make `/api/csrf` usable before sign-in.

`withCsrfProtection` was a no-op on any route under `/api/auth/`, because `requireCsrfToken` exempted the whole prefix for the sake of NextAuth's `[...nextauth]` catch-all. The one hand-written route in that prefix — `/api/auth/register` — therefore accepted a cookie-bearing cross-site POST, which is exactly what the wrapper was added to prevent.

Closing that is a two-part change, and this is the client half:

- `getCsrfToken()` lives in a new `@usequark/quark-core/csrf-client` subpath and imports nothing, so a `"use client"` component can use it. It must not join the main barrel or `@usequark/quark-core/core`: both re-export the server-side `csrf.js`, which imports `node:crypto`, and reaching the helper through either would put a Node builtin in the browser bundle. `packages/core/src/exports.test.js` asserts both halves of that.
- The helper fetches `/api/csrf`, caches the token, shares one request between concurrent callers, and refetches at 50 minutes — ahead of the cookie's one-hour `maxAge`, so a cached token cannot outlive the cookie it has to match.
- `clearCsrfToken()` drops the cache for the case the TTL cannot cover: the server rotating the cookie underneath a live client.

This also makes the documentation true. `getCsrfToken()` was referenced by `docs/TROUBLESHOOTING.md` and `docs/SECURITY_FEATURES.md` but had never been implemented.

Server-side, `GET /api/csrf` no longer requires a session, because registration is pre-authentication and a visitor with no account cannot have one. Its previous 401 guard was sound — the property that mattered was that a token must never be cacheable — and that is now enforced by headers (`Cache-Control: no-store` and `Vary: Cookie` on every response, errors included) rather than by refusing anonymous callers. The route also drops its `@/lib/auth` import, so a pre-auth page no longer pays for a Prisma-backed session read.

Narrowing the exemption in `requireCsrfToken` is deliberately **not** part of this release. Until it lands, the register page sends a token it is not yet required to, and `KNOWN GAP` tests on `/api/auth/register` still record the gap.
