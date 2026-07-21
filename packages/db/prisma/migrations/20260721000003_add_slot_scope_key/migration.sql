-- Add a scope key so slots can be shared globally or isolated per service.
ALTER TABLE "AvailabilitySlot"
ADD COLUMN IF NOT EXISTS "slotScopeKey" TEXT;

UPDATE "AvailabilitySlot"
SET "slotScopeKey" = "serviceId"
WHERE "slotScopeKey" IS NULL OR "slotScopeKey" = '';

ALTER TABLE "AvailabilitySlot"
ALTER COLUMN "slotScopeKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilitySlot_slotScopeKey_startTime_endTime_key"
ON "AvailabilitySlot"("slotScopeKey", "startTime", "endTime");

CREATE INDEX IF NOT EXISTS "AvailabilitySlot_slotScopeKey_staffId_startTime_endTime_idx"
ON "AvailabilitySlot"("slotScopeKey", "staffId", "startTime", "endTime");
