#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ ! -d node_modules ]; then
  npm ci
fi

case "${LOUSA_BUILD_MODE:-development}" in
  development|dev|debug)
    echo "[LOUSA] Development mode: device/emulator + Metro."
    exec bash scripts/build-debug-local.sh
    ;;
  qa)
    exec bash scripts/build-qa-apk.sh
    ;;
  release|production)
    exec bash scripts/build-release-apk.sh
    ;;
  *)
    echo "Unknown LOUSA_BUILD_MODE=${LOUSA_BUILD_MODE:-}" >&2
    echo "Use: development, qa, or release." >&2
    exit 2
    ;;
esac
