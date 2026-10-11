-- Reconcile migration history with the 7-model schema.
--
-- The history above created 15 domain-vertical tables (CMS, CRM, AI,
-- bookings) that were later deleted from schema.prisma but never from the
-- migration log. `migrate deploy` therefore creates them on every database,
-- and the next `migrate dev` would emit destructive, machine-local drops at
-- whatever point the developer happened to stop. Drop them once, here, in a
-- reviewed migration.
--
-- Every table below is unreferenced by application code (verified by grep
-- across apps/, packages/, and the CLI). All drops are guarded with IF
-- EXISTS so a database that never materialised a given table (e.g. one
-- created before that migration existed and never deploy-migrated past it)
-- is a no-op rather than a failure.
--
-- Also removes four redundant indexes the schema still declared until this
-- migration's companion schema edit:
--   - User_email_idx            — duplicates the unique User_email_key
--   - VerificationToken_token_idx — duplicates VerificationToken_token_key
--   - Job_status_idx, Job_runAt_idx — leftmost-prefix subsumed by Job_status_runAt_idx

-- DropForeignKey (children first)
ALTER TABLE "AiConversation" DROP CONSTRAINT IF EXISTS "AiConversation_userId_fkey";
ALTER TABLE "AiMessage" DROP CONSTRAINT IF EXISTS "AiMessage_conversationId_fkey";
ALTER TABLE "AiToolPermission" DROP CONSTRAINT IF EXISTS "AiToolPermission_userId_fkey";
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT IF EXISTS "AvailabilitySlot_serviceId_fkey";
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT IF EXISTS "AvailabilitySlot_staffId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_serviceTypeId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_slotId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_staffId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_userId_fkey";
ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_companyId_fkey";
ALTER TABLE "Deal" DROP CONSTRAINT IF EXISTS "Deal_companyId_fkey";
ALTER TABLE "Deal" DROP CONSTRAINT IF EXISTS "Deal_contactId_fkey";
ALTER TABLE "MediaAsset" DROP CONSTRAINT IF EXISTS "MediaAsset_uploadedById_fkey";
ALTER TABLE "Page" DROP CONSTRAINT IF EXISTS "Page_authorId_fkey";
ALTER TABLE "StaffService" DROP CONSTRAINT IF EXISTS "StaffService_serviceId_fkey";
ALTER TABLE "StaffService" DROP CONSTRAINT IF EXISTS "StaffService_staffId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Job_runAt_idx";
DROP INDEX IF EXISTS "Job_status_idx";
DROP INDEX IF EXISTS "User_email_idx";
DROP INDEX IF EXISTS "VerificationToken_token_idx";

-- DropTable
DROP TABLE IF EXISTS "AiConversation";
DROP TABLE IF EXISTS "AiMessage";
DROP TABLE IF EXISTS "AiToolPermission";
DROP TABLE IF EXISTS "AppConfig";
DROP TABLE IF EXISTS "AvailabilitySlot";
DROP TABLE IF EXISTS "Booking";
DROP TABLE IF EXISTS "Company";
DROP TABLE IF EXISTS "Contact";
DROP TABLE IF EXISTS "Context";
DROP TABLE IF EXISTS "Deal";
DROP TABLE IF EXISTS "MediaAsset";
DROP TABLE IF EXISTS "Page";
DROP TABLE IF EXISTS "ServiceType";
DROP TABLE IF EXISTS "Staff";
DROP TABLE IF EXISTS "StaffService";

-- DropEnum
DROP TYPE IF EXISTS "AiRole";
DROP TYPE IF EXISTS "BookingStatus";
DROP TYPE IF EXISTS "ContentStatus";
