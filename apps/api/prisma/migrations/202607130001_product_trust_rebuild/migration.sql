-- LOUSA Product Trust Rebuild
ALTER TABLE "DeliveryAddress"
  ADD COLUMN IF NOT EXISTS "deliveryIncludedInPlan" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "planCode" TEXT,
  ADD COLUMN IF NOT EXISTS "zoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'synced';

CREATE TABLE IF NOT EXISTS "CycleObservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'user',
  "periodRecordId" TEXT,
  "data" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CycleObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CycleObservation_userId_date_type_key" ON "CycleObservation"("userId", "date", "type");
CREATE INDEX IF NOT EXISTS "CycleObservation_userId_date_idx" ON "CycleObservation"("userId", "date");

DO $$ BEGIN
  ALTER TABLE "CycleObservation"
    ADD CONSTRAINT "CycleObservation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE "DeliveryAddress"
SET "deliveryFeeMinor" = 0,
    "deliveryIncludedInPlan" = TRUE
WHERE "deliveryFeeMinor" IS DISTINCT FROM 0 OR "deliveryIncludedInPlan" IS DISTINCT FROM TRUE;

UPDATE "DeliveryZone" SET "baseFeeMinor" = 0 WHERE "baseFeeMinor" IS DISTINCT FROM 0;
