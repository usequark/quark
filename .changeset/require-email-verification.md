---
"@usequark/quark-create-app": minor
---

Gate credentials sign-in on email verification, matching OAuth (review decision D1).

One flag, `REQUIRE_EMAIL_VERIFICATION`, defaults to `true` and governs both
paths: the credentials `authorize()` in `apps/web/src/lib/auth.js` now refuses
an account with no `emailVerified` on file with the same
`OAUTH_EMAIL_NOT_VERIFIED` `AppError` (401) the Google provider mapper throws,
and the existing OAuth checks (the NextAuth `profile()` mapper and the mobile
`POST /api/auth/google` route) read the same flag. `null`/unset reads as
unverified, and the password is still checked first so the error code cannot
become an account-enumeration oracle. Set `REQUIRE_EMAIL_VERIFICATION=false`
to restore the pre-gate behaviour on every path at once.

**Migration note:** registration has never set `emailVerified`, and neither
does the seed — so with the default on, every existing credentials account
that never redeemed a verification link is refused sign-in after upgrade
(and OAuth accounts whose provider reports an unconfirmed address too).
Before deploying, either confirm the installed base, tell users to request a
fresh verification link, backfill `emailVerified` for known-good addresses,
or ship with `REQUIRE_EMAIL_VERIFICATION=false` and flip it once the backlog
is verified.
