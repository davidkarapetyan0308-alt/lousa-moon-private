#!/usr/bin/env sh
set -eu

APP_ENV_VALUE="${APP_ENV:-production}"
RUN_MIGRATIONS_VALUE="${RUN_MIGRATIONS_ON_START:-true}"
SKIP_MIGRATIONS_VALUE="${SKIP_MIGRATIONS_ON_START:-false}"

if [ "$SKIP_MIGRATIONS_VALUE" = "true" ] || [ "$RUN_MIGRATIONS_VALUE" != "true" ]; then
  echo "[LOUSA] Database migrations disabled for startup."
else
  echo "[LOUSA] Applying database migrations..."
  if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
    if ! DATABASE_URL="$MIGRATION_DATABASE_URL" npm run prisma:migrate:deploy; then
      echo "[LOUSA] Prisma migrations failed with MIGRATION_DATABASE_URL." >&2
      [ "$APP_ENV_VALUE" = "development" ] || [ "$APP_ENV_VALUE" = "test" ] || exit 1
    fi
  else
    if ! npm run prisma:migrate:deploy; then
      echo "[LOUSA] Prisma migrations failed with DATABASE_URL." >&2
      [ "$APP_ENV_VALUE" = "development" ] || [ "$APP_ENV_VALUE" = "test" ] || exit 1
    fi
  fi
fi

# Auth schema fallback is idempotent and protects older QA databases, but any
# failure is fatal outside local development so /ready cannot lie about startup.
if ! node ./scripts/ensure-auth-db-schema.js; then
  echo "[LOUSA] Auth schema validation/fallback failed." >&2
  [ "$APP_ENV_VALUE" = "development" ] || [ "$APP_ENV_VALUE" = "test" ] || exit 1
fi

echo "[LOUSA] Starting public API on port ${PORT:-8080}..."
exec ./node_modules/.bin/tsx apps/api/src/server.ts
