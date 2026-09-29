---
"@techstream/quark-create-app": patch
---

Validate the session's shape in `requireAuth`, not just its truthiness

`requireAuth()` gated on `if (!session)`. That is not sufficient: a truthy
object is not the same as an authenticated user, and next-auth 5.0.0-beta.31
demonstrated the difference on the auth surface. When `@auth/core` answers a
misconfigured provider with a 500, the client returned the error body as though
it were a session, so `if (!session)` passed and callers received a "session"
with `user === undefined`.

beta.32 fixes the source by treating any non-OK response as no session, but
this guard should not depend on a pre-release library behaving correctly - one
beta bump is all it takes to fail open again. `requireAuth` now requires a
`user` with a non-empty string `id` or `sub`, so an error body, an empty
object, a userless session, and a non-string id all fail closed regardless of
what the client returns.

`requireRole` already failed closed by accident, via `session.user?.role` not
matching. That is now incidental rather than load-bearing.

`requireAuth` and `requireRole` take an optional session argument so the guard
can be tested without constructing a NextAuth instance; when omitted, both read
from `auth()` exactly as before, so no call site needs to change.

12 new tests cover the error-body case, missing user, identity-less user,
non-object user, empty-string and non-string ids, and the matching and
non-matching role paths. Negative-tested: restoring the old truthiness guard
fails 7 of them, and dropping only the identity check fails 3.
