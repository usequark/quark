---
"@usequark/quark-create-app": patch
---

fix(auth): require a verified address on the Google web sign-in too

#260 closed the mobile route: `POST /api/auth/google` now refuses a token whose
`email_verified` claim is not confirmed. The web sign-in was left with the same
gap and is closed here.

`GoogleProvider` was configured with a client id and a secret and nothing else,
so NextAuth used its default profile mapper — one that reads `profile.email`
unconditionally and hands it to the Prisma adapter, which creates the user on
first sight. An address Google has not confirmed therefore reached the database
with the confirmation that is supposed to establish ownership of it skipped.
Google does issue tokens for unconfirmed addresses.

The provider now maps the profile itself and returns `null` for anything not
confirmed, which is Auth.js's refusal: no session, and no user row written.

`email_verified` is the same string-or-boolean claim the mobile route reads, so
the rule moved into `apps/web/src/lib/email-verified.js` and both paths now call
one helper. Two copies of that rule would be free to drift, and a drift would
read to an operator as "sign-in works on the web but not in the app".

Behaviour change: a Google account whose address is not verified can no longer
sign in through the web button. Google sets `email_verified` on every account it
will authenticate, so the accounts this turns away are the ones nobody can prove
they own.

Six tests. Dropping the `profile` option from the provider fails all six — the
assertion that the mapper exists is what stops the suite passing against the
vulnerable default — and swapping the explicit comparison for a truthiness check
fails three.

The suite reads the mapper through `provider.options.profile` because that is
where `GoogleProvider()` puts user-defined options; Auth.js hoists them onto the
provider when it parses the list at runtime, which is how every documented
`profile()` customization reaches the callback handler.