-- LOUSA V10.3.2 phone authentication foundation

ALTER TABLE "User" ADD CONSTRAINT "User_phone_key" UNIQUE ("phone");

CREATE TABLE IF NOT EXISTS "PhoneVerification" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sendCount" INTEGER NOT NULL DEFAULT 1,
  "lastSentAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PhoneVerification_phone_purpose_expiresAt_idx" ON "PhoneVerification"("phone", "purpose", "expiresAt");
