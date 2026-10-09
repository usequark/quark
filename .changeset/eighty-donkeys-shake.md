---
"@usequark/quark-core": patch
---

Close a path in `requireCsrfToken` that disarmed `withCsrfProtection` on every hand-written route under `/api/auth/`.

The check skipped any path matching `path.startsWith("/api/auth/")`, written for NextAuth's `[...nextauth]` catch-all. The exemption was unnecessary: `app/api/auth/[...nextauth]/route.js` exports `handlers.GET`/`handlers.POST` directly and is never wrapped in `withCsrfProtection`, so a request to `/api/auth/signin` or `/api/auth/callback/credentials` never reaches `requireCsrfToken` at all. NextAuth validates its own CSRF token inside its handler.

It was not free. `/api/auth/register` is a hand-written route inside that prefix whose wrapper had therefore never run a check — a cookie-bearing browser could be POSTed to it cross-site and create an account, which is the exact attack `withCsrfProtection` was added there to stop.

`requireCsrfToken` now skips only safe methods and `Bearer`-authenticated requests. No path is exempt by name.

**This changes behaviour for any consumer wrapping a route under `/api/auth/` in `withCsrfProtection`.** Such requests previously passed unchecked and now receive `401` unless they carry a matching `csrf_token` cookie and `x-csrf-token` header. Obtain a token from `GET /api/csrf` first — `getCsrfToken()` in `@usequark/quark-core/csrf-client` does this and is safe to call before sign-in.

Safe methods and `Bearer` requests are unaffected. `withCsrfProtection` still returns `401` rather than throwing.
