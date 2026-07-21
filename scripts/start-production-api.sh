#!/usr/bin/env sh
set -eu

if [ "${SKIP_MIGRATIONS_ON_START:-false}" = "true" ]; then
  echo "[LOUSA] Skipping database migrations on web startup because SKIP_MIGRATIONS_ON_START=true."
else
  node ./scripts/ensure-auth-db-schema.js
  echo "[LOUSA] Applying database migrations..."
  if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
    DATABASE_URL="$MIGRATION_DATABASE_URL" npm run prisma:migrate:deploy || echo "[LOUSA] Prisma migrations failed; continuing with auth schema fallback."
  else
    npm run prisma:migrate:deploy || echo "[LOUSA] Prisma migrations failed; continuing with auth schema fallback."
  fi
  node ./scripts/ensure-auth-db-schema.js
fi

echo "[LOUSA] Starting public API on port ${PORT:-8080}..."
exec ./node_modules/.bin/tsx apps/api/src/server.ts
