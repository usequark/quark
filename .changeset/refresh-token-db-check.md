---
"@usequark/quark-create-app": minor
---

**Security (mobile refresh tokens):** Re-derive the identity and role for `/api/auth/refresh` from the database on every exchange. Refresh tokens are now rejected if the account no longer exists or if `passwordChangedAt` is after the token's `iat` (password reset kills live refresh tokens). Role/email/name changes are reflected immediately. This mirrors the web session revocation model and closes the window where a 30-day mobile refresh token could mint access tokens for a deleted, demoted, or password-reset account.

**Tests:** Added `route.revocation.test.js` (real Prisma) proving password reset and profile changes behave correctly; updated `route.test.js` to stub the DB read.

**Docs:** Corrected the reset-password comment to accurately reflect that the refresh route rejects tokens issued before a password change.

Sync templates with the updated refresh-token revocation logic and corrected comments.
