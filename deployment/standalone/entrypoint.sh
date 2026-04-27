#!/bin/sh
# Standalone entrypoint:
#   - On first boot (empty database) load the embedded schema dump
#   - Then run any pending migrations (no-op on a fresh schema dump)
#   - Start the backend
# Disable bootstrap with SKIP_BOOTSTRAP=1, migrations with SKIP_MIGRATIONS=1.
set -e

cd /app/packages/backend

run_migrations() {
  [ "${SKIP_MIGRATIONS:-0}" = "1" ] && { echo "[entrypoint] SKIP_MIGRATIONS=1"; return; }
  if [ ! -f "./dist/config/database.config.js" ]; then
    echo "[entrypoint] WARN: compiled database.config.js not found, skipping migrations"; return
  fi
  TYPEORM_CLI=$(node -e "console.log(require.resolve('typeorm/cli.js'))" 2>/dev/null || echo "")
  [ -z "$TYPEORM_CLI" ] && { echo "[entrypoint] typeorm CLI not found, skipping"; return; }
  echo "[entrypoint] Running database migrations..."
  node "$TYPEORM_CLI" migration:run -d ./dist/config/database.config.js \
    || echo "[entrypoint] WARN: migration runner reported errors (continuing)"
}

node /app/bootstrap.js wait
node /app/bootstrap.js seed-if-empty
run_migrations

cd /app
echo "[entrypoint] Starting Glide-HIMS backend..."
exec node packages/backend/dist/main.js
