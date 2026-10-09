---
"@usequark/quark-create-app": patch
---

Scaffolded projects get a working pre-auth CSRF handshake.

The template's register page posted to `/api/auth/register` with no `x-csrf-token`, and its `/api/csrf` route required a session — so a visitor could not obtain a token, and no client anywhere in the template ever called the endpoint. The four other `withCsrfProtection` routes (`/api/users`, `/api/users/me`, `/api/files`, `/api/files/[id]`) were unreachable from the browser for the same reason.

`GET /api/csrf` now serves callers with no session and marks every response `no-store` + `Vary: Cookie`, and `RegisterPageClient` sends the token via `getCsrfToken()` from `@usequark/quark-core/csrf-client`. Builds from this template against `@usequark/quark-core` 2.6.2 or later.
