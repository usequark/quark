-- Remove duplicate Booking records, keeping the oldest one per (slotId, email)
DO $$
BEGIN
  DELETE FROM "Booking"
  WHERE "id" IN (
    SELECT "id" FROM (
      SELECT "id",
        ROW_NUMBER() OVER (
          PARTITION BY "slotId", "email"
          ORDER BY "createdAt" ASC, "id" ASC
        ) AS rn
      FROM "Booking"
    ) AS dupes
    WHERE dupes.rn > 1
  );
END $$;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_slotId_email_key" ON "Booking"("slotId", "email");
