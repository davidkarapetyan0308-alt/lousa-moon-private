#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export LOUSA_DEFAULT_ENV_FILE=.env.production
source scripts/load-env.sh

export NODE_ENV=production
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export EXPO_PUBLIC_APP_MODE=api
export EXPO_PUBLIC_AUTH_PROVIDER=firebase
export EXPO_PUBLIC_RELEASE_BUILD=true
export EXPO_PUBLIC_BUILD_CHANNEL=production
export LOUSA_BUILD_VARIANT=production
export LOUSA_ANDROID_PACKAGE=com.lousa.moon
export PUBLIC_API_URL="${PUBLIC_API_URL:-${EXPO_PUBLIC_LOUSA_API_URL:-}}"

bash scripts/validate-build-env.sh production
node scripts/validate-android-build-env.js release
node scripts/patch-expo-modules-core.js
node scripts/smoke-firebase-auth-config.js
node scripts/verify-google-oauth-config.js release
node scripts/verify-release.js
npm run typecheck
npm run lint -- --quiet
npm test -- --runInBand
npm run verify:paper-moon-entry
FIREBASE_SIGNING_VARIANT=release node scripts/verify-firebase-signing-sha.js

[[ -f android/keystore.properties ]] || { echo 'Production requires android/keystore.properties and a private upload keystore.' >&2; exit 1; }
chmod +x android/gradlew
(
  cd android
  ./gradlew clean --no-daemon --stacktrace
  ./gradlew :app:assembleRelease --no-daemon --stacktrace
)
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
[[ -f "$APK" ]] || { echo "Release APK was not created at $APK" >&2; exit 1; }
bash scripts/verify-apk.sh "$APK" production

echo "Production APK: $APK"
echo "Package: com.lousa.moon"
echo "Bundled JS: yes; Metro/Mac not required after installation."
