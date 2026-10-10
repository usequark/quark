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

The provider now maps the profile itself and throws for anything not
confirmed. Auth.js catches whatever the mapper throws and treats a missing user
as "something went wrong or the user cancelled", so the outcome is a redirect
back to the sign-in page: no session, and no user row written.

The refusal is thrown rather than returned on purpose. Auth.js has no "null
means refuse" contract — `getUserAndAccount` reads `profile.email` straight off
whatever the mapper hands back, so a null denial would work only by tripping a
`TypeError` that lands in the same catch and is logged as an
`OAuthProfileParseError`, indistinguishable from a malformed provider response.
Throwing puts the actual reason in the one place an operator can read it.

`email_verified` is the same string-or-boolean claim the mobile route reads, so
the rule moved into `apps/web/src/lib/email-verified.js` and both paths now call
one helper. Two copies of that rule would be free to drift, and a drift would
read to an operator as "sign-in works on the web but not in the app".

Behaviour change: a Google account whose address is not verified can no longer
sign in through the web button. Google sets `email_verified` on every account it
will authenticate, so the accounts this turns away are the ones nobody can prove
they own.

Seven tests. Dropping the `profile` option from the provider fails all seven —
the assertion that the mapper exists, and the helper that resolves it outside
its own try/catch, are what stop the suite passing against the vulnerable
default. Swapping the explicit comparison for a truthiness check fails four.

The suite reads the mapper through `provider.options.profile` because that is
where `GoogleProvider()` puts user-defined options; Auth.js hoists them onto the
provider when it parses the list at runtime, which is how every documented
`profile()` customization reaches the callback handler.