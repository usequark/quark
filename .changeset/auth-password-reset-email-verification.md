---
"@usequark/quark-core": minor
"@usequark/quark-create-app": minor
---

Add end-to-end password reset and email verification.

`quark-core` gains `generateToken` and `hashToken` (CSPRNG token + SHA-256
storage digest) under `quark-core/auth`, and an `emailVerificationEmail`
template.

The `quark-create-app` scaffold gains the missing caller for the reset flow and
a new verification flow:

- `POST /api/auth/forgot-password` — issues a single-use reset token (1 hour
  TTL, stored only as a digest) and enqueues `SEND_RESET_PASSWORD_EMAIL`. Answers
  one neutral body for known and unknown addresses, so it is not an enumeration
  oracle.
- `GET`/`POST /api/auth/reset-password` and `GET /api/auth/verify-email` —
  redeem links; a reset stamps `passwordChangedAt` so every prior session is
  invalidated, and verification redirects to the sign-in page with a status.
- `SEND_VERIFY_EMAIL` job plus worker handler and a registration hook that
  issues a verification link; both email hand-offs stay non-fatal.
- `/auth/forgot-password` and `/auth/reset-password` pages, and a sign-in notice
  for the verification outcome.

Password rules are extracted to a shared `passwordSchema`, so registration and
reset cannot drift. The new `forgot-password` and `reset-password` POSTs join
the strict auth rate-limit bucket.
