---
"@usequark/quark-create-app": patch
---

Make web sessions revocable: re-validate every session token against the database.

The audit's "logins can't be revoked" finding: sessions were signed JWTs
valid for 30 days, and nothing that happened to the account — deletion,
role change, password change — shortened that. `requireRole` also read the
role stamped at sign-in, so a demoted admin kept admin rights until the
token expired.

Database-backed sessions (`strategy: "database"`) are not available here:
Auth.js throws `UnsupportedStrategy` when the strategy is database and every
configured provider is credentials, and the scaffold always ships the
credentials provider. Revocation is therefore enforced in the `jwt`
callback, which now re-checks the user on every request (one indexed
primary-key read — the same cost Auth.js pays for database sessions):

- user deleted (ban-by-deletion) → token rejected, cookie cleared
- role changed → refreshed into the token; `requireRole` reads the current role
- new `User.passwordChangedAt` column → any token issued before it is
  rejected, so changing a password kills every session the old password
  created (migration backfills NULL, so no deployed user is signed out by
  the upgrade itself)
- database unreachable → fails closed, never open

Also removes `getProxyToken` from `apps/web/src/lib/proxy-auth.js`: a
JWT-cookie decoder with no production caller since the proxy's auth guard
was removed, and the one piece of code that would have silently broken
under this change. Its tests go with it; `shouldUseSecureAuthCookie`
(used by the CSRF cookie) stays.

`docs/SECURITY_FEATURES.md`'s session section now describes the real
mechanism.
