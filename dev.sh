#!/usr/bin/env bash
# Launch Glide-HIMS for local development.
#
#   ./dev.sh              start backend (:3001) + frontend (:5173)
#   ./dev.sh backend      backend only
#   ./dev.sh frontend     frontend only
#   ./dev.sh migrate      run pending migrations as the table-owner role
#   ./dev.sh seed         run the database seeder
#   ./dev.sh test:schema  check entities still match the database schema
#   ./dev.sh psql         open psql against the dev database
#
# Overrides live in packages/backend/.env.development.local and are exported
# into the environment here. Both @nestjs/config and dotenv let the process
# environment win over a .env file, so packages/backend/.env — the production
# config — stays on disk untouched and unread for these values.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT/packages/backend/.env.development.local"

# Node and Postgres are user-local installs on this machine, not on the
# default PATH for non-login shells.
export PATH="/home/avis/opt/node-v22.14.0-linux-x64/bin:/home/avis/.local/bin:/home/avis/opt/pgsql/bin:$PATH"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — see the dev setup notes." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

cd "$ROOT"

case "${1:-all}" in
  backend)
    exec pnpm --filter @glide-hims/backend dev
    ;;
  frontend)
    exec pnpm --filter frontend dev
    ;;
  migrate)
    exec pnpm --filter @glide-hims/backend db:migrate
    ;;
  seed)
    # Seeding is an admin operation like migrating: run as the table owner so
    # row-level security does not filter the rows it is trying to insert.
    export DB_USERNAME="$DB_MIGRATION_USERNAME" DB_PASSWORD="$DB_MIGRATION_PASSWORD"
    exec pnpm --filter @glide-hims/backend db:seed
    ;;
  test:schema)
    # Entity/schema drift check. Needs the dev database, so it runs through
    # here where the DB_* overrides are already exported.
    exec pnpm --filter @glide-hims/backend test:schema
    ;;
  psql)
    shift
    exec env PGPASSWORD="$DB_MIGRATION_PASSWORD" psql \
      -h "$DB_HOST" -p "$DB_PORT" -U "$DB_MIGRATION_USERNAME" -d "$DB_NAME" "$@"
    ;;
  all)
    exec pnpm --parallel -r dev
    ;;
  *)
    echo "Unknown target: $1 (expected backend|frontend|migrate|seed|test:schema|psql|all)" >&2
    exit 1
    ;;
esac
