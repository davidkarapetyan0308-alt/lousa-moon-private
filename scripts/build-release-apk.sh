#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source scripts/load-env.sh

node scripts/patch-expo-modules-core.js

export EXPO_PUBLIC_APP_MODE=api
export EXPO_PUBLIC_AUTH_PROVIDER=firebase
export EXPO_PUBLIC_RELEASE_BUILD=true
export EXPO_PUBLIC_BUILD_CHANNEL=production
export LOUSA_BUILD_VARIANT=production
export LOUSA_ANDROID_PACKAGE=com.lousa.moon

node scripts/validate-android-build-env.js release
node scripts/smoke-firebase-auth-config.js
node scripts/verify-release.js
FIREBASE_SIGNING_VARIANT=release node scripts/verify-firebase-signing-sha.js

[ -f android/keystore.properties ] || { echo 'Release requires android/keystore.properties and a private upload keystore.' >&2; exit 1; }
chmod +x android/gradlew
(
  cd android
  ./gradlew clean --stacktrace
  ./gradlew :app:assembleRelease --stacktrace
)
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || { echo "Release APK was not created at $APK" >&2; exit 1; }
echo "Release APK: $APK"
echo "Package: com.lousa.moon; HTTPS-only; private signing key."
