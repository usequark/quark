---
"@usequark/quark-core": patch
---

`withCsrfProtection` returns a `401` Response on a failed check instead of
throwing.

The check runs in the wrapper, outside the route handler's own `try`/`catch`, so
a rejection escaped `handleError` entirely. Every `withCsrfProtection` route —
`users/route.js`, `users/[id]/route.js`, `users/me/route.js`, `files/route.js`,
`files/[id]/route.js` and `auth/register/route.js` — reached the client as an
unhandled rejection rather than the status code its fetch handling expects.

Only `UnauthorizedError` is converted. Any other error from the check keeps
propagating, so a genuine fault is not reported to the caller as an
authentication problem.