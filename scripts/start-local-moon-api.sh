#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node 20 or 22 and retry." >&2
  exit 1
fi
if [ ! -x "$ROOT/node_modules/.bin/tsx" ]; then
  echo "Dependencies are missing. Run npm ci first." >&2
  exit 1
fi

export APP_ENV="${APP_ENV:-development}"
export NODE_ENV="${NODE_ENV:-development}"
export API_HOST="${API_HOST:-0.0.0.0}"
export PORT="${PORT:-4102}"
export PUBLIC_API_URL="${PUBLIC_API_URL:-http://127.0.0.1:${PORT}}"
export DATABASE_URL="${DATABASE_URL:-postgresql://lousa:lousa@127.0.0.1:5432/lousa_moon?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export REQUIRE_REDIS="${REQUIRE_REDIS:-false}"
export AUTH_PROVIDER="${AUTH_PROVIDER:-firebase}"
export FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-lousa-moon}"

if [ -z "${FIREBASE_WEB_API_KEY:-}" ] && [ -f android/app/google-services.json ]; then
  export FIREBASE_WEB_API_KEY="$(node - <<'NODE'
const config = require('./android/app/google-services.json');
const client = config.client.find(
  (item) => item.client_info?.android_client_info?.package_name === 'com.lousa.moon.qa',
);
const apiKey = client?.api_key?.[0]?.current_key;
if (apiKey) process.stdout.write(apiKey);
NODE
)"
fi

export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-local_access_secret_change_me}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-local_refresh_secret_change_me}"
export EMAIL_PROVIDER="${EMAIL_PROVIDER:-console}"
export EMAIL_FROM="${EMAIL_FROM:-LOUSA MOON <onboarding@lousa.local>}"
export SMS_PROVIDER="${SMS_PROVIDER:-console}"
export PAYMENT_PROVIDER="${PAYMENT_PROVIDER:-sandbox}"
export PAYMENT_WEBHOOK_SECRET="${PAYMENT_WEBHOOK_SECRET:-local_webhook_secret_change_me}"

exec "$ROOT/node_modules/.bin/tsx" apps/api/src/server.ts
