-- Shared online courier operations: shifts, live locations, devices and delivery proof.
CREATE TABLE "CourierShift" (
  "id" TEXT NOT NULL,
  "courierId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "startLatitude" DOUBLE PRECISION,
  "startLongitude" DOUBLE PRECISION,
  "endLatitude" DOUBLE PRECISION,
  "endLongitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourierShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourierLocation" (
  "id" TEXT NOT NULL,
  "courierId" TEXT NOT NULL,
  "shiftId" TEXT,
  "deliveryTaskId" TEXT,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "heading" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourierLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourierDevice" (
  "id" TEXT NOT NULL,
  "courierId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "platform" TEXT,
  "pushToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourierDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryProof" (
  "id" TEXT NOT NULL,
  "deliveryTaskId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "otpCodeHash" TEXT,
  "note" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "accuracy" DOUBLE PRECISION,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "courierId" TEXT;

CREATE UNIQUE INDEX "CourierDevice_courierId_deviceId_key" ON "CourierDevice"("courierId", "deviceId");
CREATE INDEX "CourierDevice_pushToken_idx" ON "CourierDevice"("pushToken");
CREATE INDEX "CourierShift_courierId_status_idx" ON "CourierShift"("courierId", "status");
CREATE INDEX "CourierShift_status_startedAt_idx" ON "CourierShift"("status", "startedAt");
CREATE INDEX "CourierLocation_courierId_recordedAt_idx" ON "CourierLocation"("courierId", "recordedAt");
CREATE INDEX "CourierLocation_deliveryTaskId_recordedAt_idx" ON "CourierLocation"("deliveryTaskId", "recordedAt");
CREATE INDEX "DeliveryProof_deliveryTaskId_createdAt_idx" ON "DeliveryProof"("deliveryTaskId", "createdAt");
CREATE INDEX "SupportTicket_courierId_status_idx" ON "SupportTicket"("courierId", "status");

ALTER TABLE "CourierShift" ADD CONSTRAINT "CourierShift_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourierLocation" ADD CONSTRAINT "CourierLocation_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourierLocation" ADD CONSTRAINT "CourierLocation_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "CourierShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourierLocation" ADD CONSTRAINT "CourierLocation_deliveryTaskId_fkey" FOREIGN KEY ("deliveryTaskId") REFERENCES "DeliveryTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourierDevice" ADD CONSTRAINT "CourierDevice_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_deliveryTaskId_fkey" FOREIGN KEY ("deliveryTaskId") REFERENCES "DeliveryTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
