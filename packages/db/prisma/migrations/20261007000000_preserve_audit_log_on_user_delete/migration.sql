-- Preserve audit records when the actor is deleted.
--
-- `AuditLog.userId` was NOT NULL with ON DELETE CASCADE, so deleting a user
-- destroyed every record of what that user did — including the records of the
-- deletion itself. Make the column nullable and switch the FK to ON DELETE SET NULL
-- so the rows survive.
--
-- `actorEmail` snapshots the address at write time. SET NULL alone leaves the row
-- naming nobody, so this backfill and `auditLog.create` both populate it.

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "actorEmail" TEXT;

-- Backfill existing rows from the user they still point at. Rows whose user is
-- already gone keep a null actorEmail: there is nothing to derive it from.
UPDATE "AuditLog" AS a
SET "actorEmail" = u."email"
FROM "User" AS u
WHERE a."userId" = u."id" AND a."actorEmail" IS NULL;

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;