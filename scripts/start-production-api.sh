#!/usr/bin/env sh
set -eu

if [ "${RUN_MIGRATIONS_ON_START:-false}" = "true" ]; then
  echo "[LOUSA] Applying database migrations..."
  if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
    DATABASE_URL="$MIGRATION_DATABASE_URL" npm run prisma:migrate:deploy
  else
    npm run prisma:migrate:deploy
  fi
else
  echo "[LOUSA] Skipping database migrations on web startup."
fi

echo "[LOUSA] Starting public API on port ${PORT:-8080}..."
exec ./node_modules/.bin/tsx apps/api/src/server.ts
