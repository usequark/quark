-- Add durationMinutes column to Booking with default 30
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 30;

-- Update existing rows to have a sensible default
UPDATE "Booking" SET "durationMinutes" = 30 WHERE "durationMinutes" IS NULL OR "durationMinutes" = 0;
