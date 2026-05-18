-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "content" JSONB,
ADD COLUMN     "layout" TEXT NOT NULL DEFAULT 'standard';
