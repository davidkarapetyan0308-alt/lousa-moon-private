#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source scripts/load-env.sh

export EXPO_PUBLIC_APP_MODE=api
export EXPO_PUBLIC_AUTH_PROVIDER=firebase
export EXPO_PUBLIC_RELEASE_BUILD=false
export EXPO_PUBLIC_BUILD_CHANNEL=development
export LOUSA_BUILD_VARIANT=production
export LOUSA_ANDROID_PACKAGE=com.lousa.moon

node scripts/smoke-firebase-auth-config.js
bash scripts/ensure-standard-debug-keystore.sh
FIREBASE_SIGNING_VARIANT=debug node scripts/verify-firebase-signing-sha.js

echo "[LOUSA] Starting a development Android build with Metro."
echo "[LOUSA] Do not copy app-debug.apk to a phone and expect it to run without Metro."
exec npx expo run:android
