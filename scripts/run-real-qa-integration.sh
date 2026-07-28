#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "BLOCKED: Docker is required for the real PostgreSQL/Redis QA integration environment." >&2
  exit 2
fi
if [ ! -d node_modules ]; then
  echo "BLOCKED: node_modules is absent. Run npm ci with a working npm registry first." >&2
  exit 2
fi

export APP_ENV=test
export NODE_ENV=test
export AUTH_PROVIDER=legacy
export PAYMENT_PROVIDER=sandbox
export PAYMENT_WEBHOOK_SECRET=qa_webhook_secret
export DATABASE_URL="${DATABASE_URL:-postgresql://lousa:lousa@127.0.0.1:5432/lousa_moon?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/0}"
export REQUIRE_REDIS=true
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-qa_access_secret_not_for_production}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-qa_refresh_secret_not_for_production}"
export TEST_VERIFICATION_CODE=111111
export PORT="${PORT:-4100}"
export REAL_QA_API_URL="http://127.0.0.1:${PORT}"

cleanup() {
  if [ -n "${API_PID:-}" ]; then kill "$API_PID" >/dev/null 2>&1 || true; fi
  docker compose down >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose up -d postgres redis

for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U lousa -d lousa_moon >/dev/null 2>&1; then break; fi
  sleep 1
done

docker compose exec -T postgres pg_isready -U lousa -d lousa_moon >/dev/null
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run api:start > /tmp/lousa-real-qa-api.log 2>&1 &
API_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS "${REAL_QA_API_URL}/health" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$API_PID" >/dev/null 2>&1; then
    cat /tmp/lousa-real-qa-api.log >&2
    exit 1
  fi
  sleep 1
done

curl -fsS "${REAL_QA_API_URL}/health" >/dev/null
node scripts/real-qa-http-smoke.mjs
npm run test:integration -- --runInBand

echo "real QA integration PASS"
