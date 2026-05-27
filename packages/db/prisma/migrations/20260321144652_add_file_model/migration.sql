/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE IF EXISTS "Post" DROP CONSTRAINT IF EXISTS "Post_authorId_fkey";

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE IF EXISTS "Post";

-- CreateTable
CREATE TABLE IF NOT EXISTS "File" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "File_storageKey_key" ON "File"("storageKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "File_uploadedById_idx" ON "File"("uploadedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "File_mimeType_idx" ON "File"("mimeType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "File_createdAt_idx" ON "File"("createdAt");

-- AddForeignKey (guarded for idempotency)
DO $$
BEGIN
  IF to_regclass('"File"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'File_uploadedById_fkey'
     ) THEN
    ALTER TABLE "File" ADD CONSTRAINT "File_uploadedById_fkey"
      FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
