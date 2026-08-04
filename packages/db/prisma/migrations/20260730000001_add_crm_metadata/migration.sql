-- AlterTable
ALTER TABLE "Company" ADD COLUMN "metadata" JSONB;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "metadata" JSONB;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "metadata" JSONB;
