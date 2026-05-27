-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'UserRole' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "UserRole" AS ENUM ('admin', 'editor', 'viewer');
  END IF;
END
$$;

-- AlterTable: safe cast preserving existing data
-- Drop the old string default before type change
DO $$
DECLARE role_udt text;
BEGIN
  SELECT c.udt_name
  INTO role_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'User'
    AND c.column_name = 'role';

  IF role_udt IS NOT NULL AND LOWER(role_udt) <> LOWER('UserRole') THEN
    ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "User"
      ALTER COLUMN "role" TYPE "UserRole"
      USING ("role"::text::"UserRole");
    ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'viewer'::"UserRole";
  END IF;
END
$$;
