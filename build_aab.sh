#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

if [ ! -d node_modules ]; then
  npm ci
fi

if [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi

if [ ! -f android/keystore.properties ]; then
  echo "AAB requires android/keystore.properties and a private upload keystore." >&2
  exit 1
fi

cd android
chmod +x gradlew
./gradlew bundleRelease

echo "AAB: $PROJECT_DIR/android/app/build/outputs/bundle/release/app-release.aab"
