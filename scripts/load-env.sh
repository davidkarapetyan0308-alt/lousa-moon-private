#!/usr/bin/env bash
set -euo pipefail

# Explicit inline variables have priority. An env file is loaded only when the
# public API URL was not already supplied by the caller.
if [[ -n "${EXPO_PUBLIC_LOUSA_API_URL:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi

ENV_FILE="${LOUSA_ENV_FILE:-${LOUSA_DEFAULT_ENV_FILE:-.env}}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
elif [[ -n "${LOUSA_ENV_FILE:-}" ]]; then
  echo "Requested env file does not exist: $ENV_FILE" >&2
  return 1 2>/dev/null || exit 1
fi
