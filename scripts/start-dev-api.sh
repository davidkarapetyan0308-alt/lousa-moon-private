#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/load-env.sh

echo "[LOUSA] Starting PostgreSQL and Redis..."
docker compose up -d postgres redis

echo "[LOUSA] Generating Prisma client..."
npm run prisma:generate

echo "[LOUSA] Applying migrations..."
npm run prisma:migrate:deploy

echo "[LOUSA] Seeding database..."
npm run prisma:seed

echo "[LOUSA] Starting API on ${PORT:-4100}..."
npm run api:dev
