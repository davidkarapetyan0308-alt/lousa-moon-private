#!/usr/bin/env sh
set -eu

APP_ENV_VALUE="${APP_ENV:-production}"
RUN_MIGRATIONS_VALUE="${RUN_MIGRATIONS_ON_START:-true}"
SKIP_MIGRATIONS_VALUE="${SKIP_MIGRATIONS_ON_START:-false}"

# Supabase's current IPv4 session pooler uses the aws-0 host prefix. Keep old
# Render secrets working after a project restore without touching passwords.
normalize_supabase_pooler_url() {
  printf '%s' "${1:-}" | sed 's/@aws-eu-central-1\.pooler\.supabase\.com:/@aws-0-eu-central-1.pooler.supabase.com:/g'
}

if [ -n "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="$(normalize_supabase_pooler_url "$DATABASE_URL")"
fi
if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
  export MIGRATION_DATABASE_URL="$(normalize_supabase_pooler_url "$MIGRATION_DATABASE_URL")"
fi

if [ "$SKIP_MIGRATIONS_VALUE" = "true" ] || [ "$RUN_MIGRATIONS_VALUE" != "true" ]; then
  echo "[LOUSA] Database migrations disabled for startup."
else
  echo "[LOUSA] Applying database migrations..."
  if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
    if ! DATABASE_URL="$MIGRATION_DATABASE_URL" npm run prisma:migrate:deploy; then
      echo "[LOUSA] Prisma migrations failed with MIGRATION_DATABASE_URL; retrying DATABASE_URL." >&2
      if [ -z "${DATABASE_URL:-}" ] || [ "$DATABASE_URL" = "$MIGRATION_DATABASE_URL" ]; then
        echo "[LOUSA] No distinct DATABASE_URL fallback is available." >&2
        [ "$APP_ENV_VALUE" = "development" ] || [ "$APP_ENV_VALUE" = "test" ] || exit 1
      elif ! DATABASE_URL="$DATABASE_URL" npm run prisma:migrate:deploy; then
        echo "[LOUSA] Prisma migrations failed with DATABASE_URL fallback." >&2
        [ "$APP_ENV_VALUE" = "development" ] || [ "$APP_ENV_VALUE" = "test" ] || exit 1
      fi
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
