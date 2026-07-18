-- LOUSA Admin V1 foundation. Safe additive migration.
CREATE TABLE IF NOT EXISTS "AdminUser" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'ADMIN',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AdminSession" (
  "id" TEXT PRIMARY KEY,
  "adminUserId" TEXT NOT NULL REFERENCES "AdminUser"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash" TEXT,
  "userAgentHash" TEXT
);
CREATE INDEX IF NOT EXISTS "AdminSession_adminUserId_expiresAt_idx" ON "AdminSession"("adminUserId", "expiresAt");
CREATE TABLE IF NOT EXISTS "OrderEvent" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "publicTitleRu" TEXT NOT NULL,
  "publicBodyRu" TEXT,
  "internalNote" TEXT,
  "visibleToCustomer" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");
CREATE TABLE IF NOT EXISTS "PackingTask" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assignedToAdminId" TEXT REFERENCES "AdminUser"("id"),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PackingTask_orderId_status_idx" ON "PackingTask"("orderId", "status");
CREATE TABLE IF NOT EXISTS "PackingTaskItem" (
  "id" TEXT PRIMARY KEY,
  "packingTaskId" TEXT NOT NULL REFERENCES "PackingTask"("id") ON DELETE CASCADE,
  "orderItemId" TEXT NOT NULL REFERENCES "OrderItem"("id"),
  "quantity" INTEGER NOT NULL,
  "packedQuantity" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Courier" (
  "id" TEXT PRIMARY KEY,
  "adminUserId" TEXT,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "CourierAssignment" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "courierId" TEXT NOT NULL REFERENCES "Courier"("id"),
  "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pickedUpAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS "InventoryMovement" (
  "id" TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL REFERENCES "ProductCatalogItem"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT,
  "adminUserId" TEXT REFERENCES "AdminUser"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "SupportNote" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT REFERENCES "Order"("id") ON DELETE CASCADE,
  "userId" TEXT,
  "adminUserId" TEXT NOT NULL REFERENCES "AdminUser"("id"),
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
