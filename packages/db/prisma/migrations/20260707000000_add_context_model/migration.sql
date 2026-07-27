-- Add lead_dev role variant (used in authorization-aware Context model)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'lead_dev';

-- CreateTable: Context — living knowledge base for AI
CREATE TABLE IF NOT EXISTS "Context" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Context_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Context_key_category_key" ON "Context"("key", "category");
CREATE INDEX IF NOT EXISTS "Context_category_idx" ON "Context"("category");
CREATE INDEX IF NOT EXISTS "Context_source_idx" ON "Context"("source");
