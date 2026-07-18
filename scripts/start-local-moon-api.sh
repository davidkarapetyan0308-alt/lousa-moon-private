#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE_BIN="/Users/davidkarapetyan/Library/Application Support/Herd/config/nvm/versions/node/v22.22.0/bin"
export PATH="$NODE_BIN:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

export APP_ENV=development
export NODE_ENV=development
export API_HOST=0.0.0.0
export PORT=4102
export PUBLIC_API_URL="http://192.168.1.102:4102"
export DATABASE_URL="postgresql://lousa:lousa@127.0.0.1:5432/lousa_moon?schema=public"
export REDIS_URL="redis://127.0.0.1:6379"
export REQUIRE_REDIS=false
export AUTH_PROVIDER=firebase
export FIREBASE_PROJECT_ID=lousa-moon
export FIREBASE_WEB_API_KEY="$(node - <<'NODE'
const config = require('./android/app/google-services.json');
const client = config.client.find(
  (item) => item.client_info?.android_client_info?.package_name === 'com.lousa.moon.qa',
);
const apiKey = client?.api_key?.[0]?.current_key;
if (!apiKey) process.exit(1);
process.stdout.write(apiKey);
NODE
)"
export JWT_ACCESS_SECRET="lousa-moon-local-access-build112"
export JWT_REFRESH_SECRET="lousa-moon-local-refresh-build112"
export EMAIL_PROVIDER=console
export EMAIL_FROM="LOUSA MOON <onboarding@lousa.local>"
export SMS_PROVIDER=console
export PAYMENT_PROVIDER=sandbox

exec "$ROOT/node_modules/.bin/tsx" apps/api/src/server.ts
