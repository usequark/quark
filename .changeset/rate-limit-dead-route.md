---
"@usequark/quark-create-app": patch
---

fix(proxy): stop spending the strict auth rate-limit budget on a dead route

`STRICT_AUTH_RATE_LIMIT_ROUTES` listed `POST /api/auth/signin/credentials`, but
no client ever posts there: the next-auth client sends credentials sign-ins to
`/api/auth/callback/credentials` (it picks `callback/<provider>` for credentials
providers), and `@auth/core`'s POST `signin` action for a credentials provider
only redirects to the sign-in page. The dead entry wasted one of the bucket's 5
requests per 15 minutes on a no-op and left the set claiming protection the
app did not need. It now covers exactly the two paths that verify a credential:
`callback/credentials` and the hand-written `register` route.
