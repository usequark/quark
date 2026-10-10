---
"@usequark/quark-create-app": patch
---

fix(auth): refuse Google sign-in for an unverified address

`POST /api/auth/google` checked that the token was genuine and bound to this
app, then read the address off it and either signed that account in or created
it on the spot. It never looked at `email_verified`.

Google issues ID tokens for unconfirmed addresses — some Workspace accounts,
and accounts created recently enough that the confirmation round-trip has not
finished. Nothing about such a token proves the person presenting it can read
the inbox, and since this route creates the account on first sight, the
confirmation that is supposed to establish ownership of the address was simply
skipped. A working address on an account someone else controls is an account to
receive password resets and notifications for, not proof of identity.

The check is deliberately strict: only an explicit confirmation passes. A
missing claim, a null, a number, or anything that is not `true` is refused —
a wrong refusal costs one unlucky sign-in, and a wrong acceptance hands an
unconfirmed address a session. Google's `tokeninfo` endpoint reports the claim
as the string `"true"`, not a boolean, so a naive truthiness check would have
done the opposite of the obvious thing: accepted `"false"` while rejecting every
real sign-in. The helper accepts both the string and boolean spellings.

Ordering: the check runs after the missing-email `400`, which describes the
shape of a token rather than reporting a refusal, and before any database work.
An unverified address never reaches `findByEmail`, so it cannot become an
account-creation or existence oracle.

Refusals return the same generic `401` as every other verification failure.
A distinct message would tell a caller that their token was structurally valid
and name the one check left to work around.

Behaviour change: a Google account whose address is not verified can no longer
sign in through this endpoint. Verify the address in the Google account, or
sign in with a provider that returns a confirmed one.

Seven tests, each mutation-checked — replacing the helper's explicit comparison
with a truthiness check fails 4, returning `true` from it fails 5, and removing
the check fails 5.