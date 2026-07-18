#!/usr/bin/env bash
set -euo pipefail
KEYSTORE="${ANDROID_DEBUG_KEYSTORE:-$HOME/.android/debug.keystore}"
if [ -f "$KEYSTORE" ]; then
  exit 0
fi
if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool is required to create the standard Android debug keystore." >&2
  exit 1
fi
mkdir -p "$(dirname "$KEYSTORE")"
keytool -genkeypair -v \
  -storetype JKS \
  -keystore "$KEYSTORE" \
  -storepass android \
  -alias androiddebugkey \
  -keypass android \
  -dname "CN=Android Debug,O=Android,C=US" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 >/dev/null
printf '[LOUSA] Created standard debug keystore: %s\n' "$KEYSTORE"
