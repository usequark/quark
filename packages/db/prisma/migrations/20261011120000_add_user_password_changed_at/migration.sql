-- Session revocation primitive: `User.passwordChangedAt`.
--
-- Web sessions are signed JWTs (Auth.js requires the JWT strategy whenever a
-- credentials provider is configured, which every scaffold has). A signed
-- token cannot be revoked by deletion of a server-side row, so revocation is
-- expressed as a timestamp comparison instead: the `jwt` callback re-checks
-- the user on every request and rejects any token issued before
-- `passwordChangedAt`. Bumping the column on a password change therefore
-- kills every session the old password created, immediately.
--
-- Backfilled as NULL: existing tokens all compare as "issued after null",
-- which is the correct transition — no deployed user is signed out by the
-- migration itself.

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
