-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'editor', 'viewer');

-- AlterTable: safe cast preserving existing data
-- Drop the old string default before type change
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

-- Convert string column to enum (lowercase values match existing data)
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole"
  USING ("role"::"UserRole");

-- Re-set the default as enum value
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'viewer'::"UserRole";
