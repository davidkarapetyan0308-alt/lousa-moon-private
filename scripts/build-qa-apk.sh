#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source scripts/load-env.sh

node scripts/patch-expo-modules-core.js

export EXPO_PUBLIC_APP_MODE=api
export EXPO_PUBLIC_AUTH_PROVIDER=firebase
export EXPO_PUBLIC_RELEASE_BUILD=false
export EXPO_PUBLIC_BUILD_CHANNEL=qa
export LOUSA_BUILD_VARIANT=qa
export LOUSA_ANDROID_PACKAGE=com.lousa.moon.qa

node scripts/validate-android-build-env.js qa
node scripts/smoke-firebase-auth-config.js
bash scripts/ensure-standard-debug-keystore.sh
FIREBASE_SIGNING_VARIANT=qa node scripts/verify-firebase-signing-sha.js

chmod +x android/gradlew
(
  cd android
  ./gradlew clean --stacktrace
  ./gradlew :app:assembleQa --stacktrace
)
APK="$ROOT/android/app/build/outputs/apk/qa/app-qa.apk"
[ -f "$APK" ] || { echo "QA APK was not created at $APK" >&2; exit 1; }
echo "QA APK: $APK"
echo "Package: com.lousa.moon.qa; bundled JS; Metro is not required."
