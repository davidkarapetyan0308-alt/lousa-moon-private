#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const root = process.cwd();
const prismaBin = path.join(root, 'node_modules', '.bin', 'prisma');
const schemaPath = path.join(root, 'apps', 'api', 'prisma', 'schema.prisma');

const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3) NULL,
  "passwordHash" TEXT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NULL,
  "language" TEXT DEFAULT 'ru' NOT NULL,
  "status" TEXT DEFAULT 'active' NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "deletedAt" TIMESTAMP(3) NULL,
  PRIMARY KEY ("id")
);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3) NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'LOUSA';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'ru';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User" ("phone") WHERE "phone" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "AuthIdentity" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerSubject" TEXT NOT NULL,
  "providerEmail" TEXT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AuthIdentity_provider_providerSubject_key" ON "AuthIdentity" ("provider", "providerSubject");
CREATE INDEX IF NOT EXISTS "AuthIdentity_userId_provider_idx" ON "AuthIdentity" ("userId", "provider");

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "deviceName" TEXT NULL,
  "ipHash" TEXT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3) NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_refreshTokenHash_key" ON "Session" ("refreshTokenHash");
CREATE INDEX IF NOT EXISTS "Session_userId_expiresAt_idx" ON "Session" ("userId", "expiresAt");
`;

if (!process.env.DATABASE_URL) {
  console.log('[LOUSA] DATABASE_URL is not set; skipping auth schema fallback.');
  process.exit(0);
}

console.log('[LOUSA] Ensuring auth database schema fallback...');
const result = spawnSync(prismaBin, ['db', 'execute', '--schema', schemaPath, '--stdin'], {
  cwd: root,
  env: process.env,
  input: sql,
  encoding: 'utf8',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) {
  console.error(`[LOUSA] Auth database schema fallback failed with exit code ${result.status}.`);
  process.exit(result.status || 1);
}

console.log('[LOUSA] Auth database schema fallback is ready.');
