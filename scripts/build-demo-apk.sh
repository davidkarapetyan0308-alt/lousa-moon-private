#!/usr/bin/env bash
set -euo pipefail
cat >&2 <<'MSG'
[LOUSA] Demo APK build is disabled.
A demo/fake release must not be distributed as LOUSA MOON.
Use one of these real workflows:
  npm run android              # development build with Metro
  npm run android:apk:qa       # standalone QA, com.lousa.moon.qa
  npm run android:apk:release  # production, HTTPS + private signing key
MSG
exit 1
