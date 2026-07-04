-- AlterTable
ALTER TABLE "AiConversation" ADD COLUMN "summary" TEXT,
ADD COLUMN "summaryTokens" INTEGER,
ADD COLUMN "summaryUpdatedAt" TIMESTAMP(3);
