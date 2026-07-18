-- LOUSA product quality traceability. Must be deployed before warehouse QA features are enabled.
CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "country" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "agreementStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "qualityStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "certificates" JSONB,
  "lastAuditAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductBatch" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "lotNumber" TEXT NOT NULL,
  "manufactureDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quantityReceived" INTEGER NOT NULL,
  "quantityAvailable" INTEGER NOT NULL,
  "warehouseId" TEXT NOT NULL DEFAULT 'gyumri-main',
  "storageLocation" TEXT,
  "storageCondition" TEXT,
  "qaStatus" TEXT NOT NULL DEFAULT 'QUARANTINE',
  "qaCheckedAt" TIMESTAMP(3),
  "qaCheckedBy" TEXT,
  "qaNotes" TEXT,
  "certificateReferences" JSONB,
  "recallStatus" TEXT NOT NULL DEFAULT 'CLEAR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BoxPackingRecord" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "packedBy" TEXT NOT NULL,
  "checkedBy" TEXT,
  "qaStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "qaReleasedAt" TIMESTAMP(3),
  "sealedAt" TIMESTAMP(3),
  "sealId" TEXT,
  "measuredWeightG" INTEGER,
  "photoReference" TEXT,
  "substitutionLog" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BoxPackingRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BoxPackingBatch" (
  "id" TEXT NOT NULL,
  "packingRecordId" TEXT NOT NULL,
  "productBatchId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "BoxPackingBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductComplaint" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productBatchId" TEXT,
  "reason" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'NORMAL',
  "evidence" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "recallLink" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ProductComplaint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductBatch_supplierId_lotNumber_productId_key" ON "ProductBatch"("supplierId", "lotNumber", "productId");
CREATE INDEX "ProductBatch_productId_qaStatus_expiryDate_idx" ON "ProductBatch"("productId", "qaStatus", "expiryDate");
CREATE INDEX "ProductBatch_warehouseId_recallStatus_idx" ON "ProductBatch"("warehouseId", "recallStatus");
CREATE UNIQUE INDEX "BoxPackingRecord_orderId_key" ON "BoxPackingRecord"("orderId");
CREATE UNIQUE INDEX "BoxPackingRecord_sealId_key" ON "BoxPackingRecord"("sealId");
CREATE INDEX "BoxPackingRecord_qaStatus_createdAt_idx" ON "BoxPackingRecord"("qaStatus", "createdAt");
CREATE UNIQUE INDEX "BoxPackingBatch_packingRecordId_productBatchId_key" ON "BoxPackingBatch"("packingRecordId", "productBatchId");
CREATE INDEX "ProductComplaint_orderId_status_idx" ON "ProductComplaint"("orderId", "status");
CREATE INDEX "ProductComplaint_productBatchId_severity_idx" ON "ProductComplaint"("productBatchId", "severity");

ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BoxPackingRecord" ADD CONSTRAINT "BoxPackingRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoxPackingBatch" ADD CONSTRAINT "BoxPackingBatch_packingRecordId_fkey" FOREIGN KEY ("packingRecordId") REFERENCES "BoxPackingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoxPackingBatch" ADD CONSTRAINT "BoxPackingBatch_productBatchId_fkey" FOREIGN KEY ("productBatchId") REFERENCES "ProductBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductComplaint" ADD CONSTRAINT "ProductComplaint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductComplaint" ADD CONSTRAINT "ProductComplaint_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductComplaint" ADD CONSTRAINT "ProductComplaint_productBatchId_fkey" FOREIGN KEY ("productBatchId") REFERENCES "ProductBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CycleObservation" ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;
