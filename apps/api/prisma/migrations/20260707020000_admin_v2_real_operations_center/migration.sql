-- LOUSA ADMIN V2 — Real Operations Center
-- Add operational fields for product intent flags, public/internal timeline separation, courier-ready support tickets.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE "ProductCatalogItem" ADD COLUMN IF NOT EXISTS "costMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProductCatalogItem" ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "ProductCatalogItem" ADD COLUMN IF NOT EXISTS "isIncludedInPlan" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductCatalogItem" ADD COLUMN IF NOT EXISTS "isRecommendedOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductCatalogItem" ADD COLUMN IF NOT EXISTS "isPaidAddon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductCatalogItem" ADD COLUMN IF NOT EXISTS "isOneTimeAddon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductCatalogItem" ADD COLUMN IF NOT EXISTS "isRecurringAddon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductCatalogItem" ADD COLUMN IF NOT EXISTS "visibleInApp" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "OrderEvent" ADD COLUMN IF NOT EXISTS "publicTitle" TEXT;
ALTER TABLE "OrderEvent" ADD COLUMN IF NOT EXISTS "publicBody" TEXT;
ALTER TABLE "OrderEvent" ADD COLUMN IF NOT EXISTS "internalTitle" TEXT;
ALTER TABLE "OrderEvent" ADD COLUMN IF NOT EXISTS "internalBody" TEXT;
ALTER TABLE "OrderEvent" ADD COLUMN IF NOT EXISTS "createdByAdminUserId" TEXT;

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "orderId" TEXT,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "safeSummary" TEXT,
  "internalNote" TEXT,
  "assignedAdminUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "SupportTicket_userId_status_idx" ON "SupportTicket"("userId", "status");
CREATE INDEX IF NOT EXISTS "SupportTicket_orderId_status_idx" ON "SupportTicket"("orderId", "status");
