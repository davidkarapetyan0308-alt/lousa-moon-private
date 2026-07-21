#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source scripts/load-env.sh

export NODE_ENV=production
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

node scripts/patch-expo-modules-core.js

export EXPO_PUBLIC_APP_MODE=api
export EXPO_PUBLIC_AUTH_PROVIDER=firebase
export EXPO_PUBLIC_RELEASE_BUILD=false
export EXPO_PUBLIC_BUILD_CHANNEL=qa
export LOUSA_BUILD_VARIANT=qa
export LOUSA_ANDROID_PACKAGE=com.lousa.moon.qa

node scripts/validate-android-build-env.js qa
node scripts/smoke-firebase-auth-config.js
node scripts/smoke-online-firebase-runtime.js
bash scripts/ensure-standard-debug-keystore.sh
FIREBASE_SIGNING_VARIANT=qa node scripts/verify-firebase-signing-sha.js

chmod +x android/gradlew
(
  cd android
  GRADLE_STABLE_FLAGS=(--no-parallel --max-workers=1 --stacktrace)
  ./gradlew clean "${GRADLE_STABLE_FLAGS[@]}"
  ./gradlew :app:assembleQa -PreactNativeArchitectures=armeabi-v7a,arm64-v8a "${GRADLE_STABLE_FLAGS[@]}"
)
APK="$ROOT/android/app/build/outputs/apk/qa/app-qa.apk"
[ -f "$APK" ] || { echo "QA APK was not created at $APK" >&2; exit 1; }
echo "QA APK: $APK"
echo "Package: com.lousa.moon.qa; bundled JS; Metro is not required."
