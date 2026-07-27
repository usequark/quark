-- AlterTable (idempotent — columns may already exist from the CREATE TABLE in 20260615000000_add_missing_ai_and_crm_models)
ALTER TABLE "AiConversation" ADD COLUMN IF NOT EXISTS "summary" TEXT,
ADD COLUMN IF NOT EXISTS "summaryTokens" INTEGER,
ADD COLUMN IF NOT EXISTS "summaryUpdatedAt" TIMESTAMP(3);
