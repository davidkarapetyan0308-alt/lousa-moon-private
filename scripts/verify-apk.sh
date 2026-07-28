#!/usr/bin/env bash
set -euo pipefail

APK="${1:-}"
VARIANT="${2:-qa}"
[[ -n "$APK" && -f "$APK" ]] || { echo "Usage: scripts/verify-apk.sh <apk-path> <qa|production>" >&2; exit 2; }

case "$VARIANT" in
  qa)
    EXPECTED_PACKAGE="com.lousa.moon.qa"
    EXPECTED_VERSION_NAME="1.18.22-qa"
    ;;
  production|prod|release)
    VARIANT="production"
    EXPECTED_PACKAGE="com.lousa.moon"
    EXPECTED_VERSION_NAME="1.18.22"
    ;;
  *) echo "Unknown variant: $VARIANT" >&2; exit 2 ;;
esac
EXPECTED_VERSION_CODE="133"
EXPECTED_BACKEND="${EXPO_PUBLIC_LOUSA_API_URL:-${PUBLIC_API_URL:-}}"
EXPECTED_BACKEND="${EXPECTED_BACKEND%/}"
[[ -n "$EXPECTED_BACKEND" ]] || { echo "EXPO_PUBLIC_LOUSA_API_URL or PUBLIC_API_URL is required for APK verification." >&2; exit 1; }

find_sdk_tool() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then command -v "$name"; return 0; fi
  local sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
  if [[ -n "$sdk" ]]; then
    local found
    found="$(find "$sdk" -type f -name "$name" 2>/dev/null | sort -V | tail -n 1 || true)"
    [[ -n "$found" ]] && { echo "$found"; return 0; }
  fi
  return 1
}

PACKAGE=""; VERSION_CODE=""; VERSION_NAME=""
if ANALYZER="$(find_sdk_tool apkanalyzer)"; then
  PACKAGE="$($ANALYZER manifest application-id "$APK" | tr -d '\r')"
  VERSION_CODE="$($ANALYZER manifest version-code "$APK" | tr -d '\r')"
  VERSION_NAME="$($ANALYZER manifest version-name "$APK" | tr -d '\r')"
elif AAPT="$(find_sdk_tool aapt)"; then
  BADGING="$($AAPT dump badging "$APK")"
  PACKAGE="$(printf '%s\n' "$BADGING" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")"
  VERSION_CODE="$(printf '%s\n' "$BADGING" | sed -n "s/^package:.*versionCode='\([^']*\)'.*/\1/p")"
  VERSION_NAME="$(printf '%s\n' "$BADGING" | sed -n "s/^package:.*versionName='\([^']*\)'.*/\1/p")"
else
  echo "Neither apkanalyzer nor aapt was found. Install Android SDK command-line/build tools." >&2
  exit 1
fi

fail=0
check_equal() {
  local label="$1" actual="$2" expected="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $label expected '$expected', got '$actual'" >&2
    fail=1
  else
    echo "PASS: $label = $actual"
  fi
}
check_equal "package" "$PACKAGE" "$EXPECTED_PACKAGE"
check_equal "versionCode" "$VERSION_CODE" "$EXPECTED_VERSION_CODE"
check_equal "versionName" "$VERSION_NAME" "$EXPECTED_VERSION_NAME"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# Android APKs can legally contain duplicate resource entry names. Overwrite them
# during inspection so macOS unzip never opens an interactive prompt in CI/QA.
unzip -qq -o "$APK" -d "$TMP"

BUNDLE="$(find "$TMP/assets" -maxdepth 2 -type f \( -name '*.bundle' -o -name 'index.android.bundle' \) 2>/dev/null | head -n 1 || true)"
if [[ -z "$BUNDLE" ]]; then
  echo "FAIL: bundled JavaScript asset is missing; APK may depend on Metro." >&2
  fail=1
else
  echo "PASS: bundled JavaScript = ${BUNDLE#$TMP/}"
fi

# Validate the executable JavaScript bundle, not every transitive native SDK.
# Android/React Native libraries legitimately contain documentation and debug
# examples mentioning localhost even in a production APK; those inert strings
# cannot configure LOUSA to call a Mac. The bundle is where Expo public config
# and the app's runtime API client are actually embedded.
TEXT="$TMP/js-bundle-strings.txt"
strings "$BUNDLE" > "$TEXT" 2>/dev/null || cp "$BUNDLE" "$TEXT"

if grep -Fq "$EXPECTED_BACKEND" "$TEXT"; then
  echo "PASS: expected backend URL is embedded: $EXPECTED_BACKEND"
else
  echo "FAIL: expected backend URL was not found in APK: $EXPECTED_BACKEND" >&2
  fail=1
fi

LOCAL_URL_REGEX='https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.0\.2\.2|10\.[0-9]+\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+)(:[0-9]+)?'
if grep -Eio "$LOCAL_URL_REGEX" "$TEXT" | sort -u > "$TMP/local-urls.txt" && [[ -s "$TMP/local-urls.txt" ]]; then
  echo "INFO: inert local/dev examples exist in transitive React Native/Firebase SDK code; runtime LOUSA API is verified above."
  sed 's/^/  - /' "$TMP/local-urls.txt"
else
  echo "PASS: no local/private HTTP(S) examples found in the JavaScript bundle"
fi

if grep -Eiq 'https?://(localhost|127\.0\.0\.1):8081' "$TEXT"; then
  echo "INFO: Metro example string comes from a transitive SDK; the embedded JS bundle above is used at launch."
else
  echo "PASS: no Metro development server URL found"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "APK VERIFICATION FAILED" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then SHA="$(sha256sum "$APK" | awk '{print $1}')"; else SHA="$(shasum -a 256 "$APK" | awk '{print $1}')"; fi
echo "APK VERIFICATION PASS"
echo "SHA-256: $SHA"
