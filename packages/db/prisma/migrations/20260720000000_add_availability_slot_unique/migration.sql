-- Remove duplicate AvailabilitySlot records, keeping the most recently created one per (serviceId, startTime, endTime)
DELETE FROM "AvailabilitySlot"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id",
      ROW_NUMBER() OVER (
        PARTITION BY "serviceId", "startTime", "endTime"
        ORDER BY "createdAt" DESC, "id" DESC
      ) AS rn
    FROM "AvailabilitySlot"
  ) AS dupes
  WHERE dupes.rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySlot_serviceId_startTime_endTime_key" ON "AvailabilitySlot"("serviceId", "startTime", "endTime");
