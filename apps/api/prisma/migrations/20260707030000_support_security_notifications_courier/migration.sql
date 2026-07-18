-- LOUSA V10.2 support, secure notifications and courier contact foundation
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "contactChannel" TEXT NOT NULL DEFAULT 'IN_APP';
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SupportMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "senderType" TEXT NOT NULL,
  "senderUserId" TEXT,
  "senderAdminUserId" TEXT,
  "body" TEXT NOT NULL,
  "safeBody" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'CUSTOMER_AND_SUPPORT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportMessage_senderUserId_createdAt_idx" ON "SupportMessage"("senderUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_updatedAt_idx" ON "SupportTicket"("status", "updatedAt");
