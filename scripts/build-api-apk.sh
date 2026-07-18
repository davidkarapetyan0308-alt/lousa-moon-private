#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[LOUSA] Legacy android:apk:api now routes to the standalone QA build."
echo "[LOUSA] Package: com.lousa.moon.qa; local LAN HTTP is allowed; JS is bundled; Metro is not required."
exec bash scripts/build-qa-apk.sh
