#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export LOUSA_DEFAULT_ENV_FILE=.env.qa
source scripts/load-env.sh

export NODE_ENV=production
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export EXPO_PUBLIC_APP_MODE=api
export EXPO_PUBLIC_AUTH_PROVIDER=firebase
export EXPO_PUBLIC_RELEASE_BUILD=false
export EXPO_PUBLIC_BUILD_CHANNEL=qa
export EXPO_PUBLIC_SHOW_TECHNICAL_ERRORS=true
export LOUSA_BUILD_VARIANT=qa
export LOUSA_ANDROID_PACKAGE=com.lousa.moon.qa
export PUBLIC_API_URL="${PUBLIC_API_URL:-${EXPO_PUBLIC_LOUSA_API_URL:-}}"

bash scripts/validate-build-env.sh qa
node scripts/validate-android-build-env.js qa
node scripts/patch-expo-modules-core.js
node scripts/smoke-firebase-auth-config.js
node scripts/verify-google-oauth-config.js qa
node scripts/smoke-online-firebase-runtime.js
npm run typecheck
npm run lint -- --quiet
npm test -- --runInBand
npm run verify:paper-moon-entry
FIREBASE_SIGNING_VARIANT=qa node scripts/verify-firebase-signing-sha.js

chmod +x android/gradlew
(
  cd android
  ./gradlew clean --no-daemon --no-parallel --max-workers=1 --stacktrace
  ./gradlew :app:assembleQa -PreactNativeArchitectures=armeabi-v7a,arm64-v8a --no-daemon --no-parallel --max-workers=1 --stacktrace
)
APK="$ROOT/android/app/build/outputs/apk/qa/app-qa.apk"
[[ -f "$APK" ]] || { echo "QA APK was not created at $APK" >&2; exit 1; }
bash scripts/verify-apk.sh "$APK" qa

echo "QA APK: $APK"
echo "Package: com.lousa.moon.qa"
echo "Bundled JS: yes; Metro/Mac not required after installation."
