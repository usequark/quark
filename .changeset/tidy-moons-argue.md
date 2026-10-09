---
"@usequark/quark-create-app": patch
---

The scaffolded register page now proves its CSRF token, and retries once if the server has rotated the cookie.

`RegisterPageClient` retried nothing on a `401`, so a client holding a token the server no longer recognises — after a sign-out, or anything else that clears cookies — was left with a dead button and no explanation. It now clears the cached token, fetches a fresh one, and retries the write once; a second failure surfaces normally.

The scaffolded integration tests send a real token instead of relying on the exemption this repo no longer ships.

Requires `@usequark/quark-core` 2.6.2 or later.
