#!/usr/bin/env bash
# Launch Glide-HIMS for local development.
#
#   ./dev.sh              start backend + frontend
#   ./dev.sh backend      backend only
#   ./dev.sh frontend     frontend only
#   ./dev.sh migrate      run pending migrations as the table-owner role
#   ./dev.sh seed         run the database seeder
#   ./dev.sh test:schema  check entities still match the database schema
#   ./dev.sh psql         open psql against the dev database (extra args passed through)
#
# Overrides live in packages/backend/.env.development.local and are exported
# into the environment here. Both @nestjs/config and dotenv let the process
# environment win over a .env file, so packages/backend/.env — the production
# config — stays on disk untouched and unread for these values.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT/packages/backend/.env.development.local"

# ---------------------------------------------------------------------------
# Tool discovery
#
# Node, pnpm and psql are often user-local installs (nvm, corepack, a tarball
# under ~/opt, Homebrew) that a non-login shell does not have on PATH. Add the
# usual locations if they exist; never assume a specific one.
# ---------------------------------------------------------------------------
prepend_path() {
  [[ -d "$1" ]] || return 0
  case ":$PATH:" in
    *":$1:"*) ;;
    *) PATH="$1:$PATH" ;;
  esac
}

for candidate in \
  "$HOME/.local/bin" \
  "$HOME/bin" \
  "$HOME"/opt/node-*/bin \
  "$HOME"/opt/pgsql/bin \
  "$HOME"/.nvm/versions/node/*/bin \
  /usr/local/bin \
  /opt/homebrew/bin \
  /usr/lib/postgresql/*/bin \
  /opt/homebrew/opt/postgresql*/bin
do
  prepend_path "$candidate"
done
export PATH

require() {
  command -v "$1" >/dev/null 2>&1 && return 0
  echo "dev.sh: '$1' not found on PATH." >&2
  case "$1" in
    pnpm) echo "  Install it with: corepack enable && corepack prepare pnpm@9 --activate" >&2 ;;
    node) echo "  This repo requires Node >=20 (see \"engines\" in package.json)." >&2 ;;
    psql) echo "  Install the PostgreSQL client (e.g. apt install postgresql-client)." >&2 ;;
  esac
  exit 1
}

require node
require pnpm

if [[ ! -f "$ENV_FILE" ]]; then
  cat >&2 <<EOF
dev.sh: missing $ENV_FILE

Create it with your local database settings — it is gitignored, so the values
stay on this machine. At minimum:

  NODE_ENV=development
  DB_HOST=127.0.0.1
  DB_PORT=5432                  # whatever port your Postgres listens on
  DB_NAME=glide_hims_dev
  DB_USERNAME=...               # the role the app connects as (non-owner)
  DB_PASSWORD=...
  DB_MIGRATION_USERNAME=...     # the table owner, used for migrations/seeding
  DB_MIGRATION_PASSWORD=...
  PORT=3001                     # any free port
  JWT_SECRET=...                # >= 32 characters
  JWT_REFRESH_SECRET=...        # >= 32 characters

See packages/backend/.env.example for the full set of supported variables and
deployment/db-init/10-rls-roles.sh for provisioning the two database roles.
EOF
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Migrations and seeding run as the table owner so row-level security does not
# filter them; fall back to the app role when no separate owner is configured.
OWNER_USER="${DB_MIGRATION_USERNAME:-${DB_USERNAME:-}}"
OWNER_PASS="${DB_MIGRATION_PASSWORD:-${DB_PASSWORD:-}}"

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
    export DB_USERNAME="$OWNER_USER" DB_PASSWORD="$OWNER_PASS"
    exec pnpm --filter @glide-hims/backend db:seed
    ;;
  test:schema)
    # Entity/schema drift check. Needs the dev database, so it runs through
    # here where the DB_* overrides are already exported.
    exec pnpm --filter @glide-hims/backend test:schema
    ;;
  psql)
    require psql
    shift
    exec env PGPASSWORD="$OWNER_PASS" psql \
      -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" \
      -U "$OWNER_USER" -d "${DB_NAME:-${DB_DATABASE:-}}" "$@"
    ;;
  all)
    exec pnpm --parallel -r dev
    ;;
  -h | --help | help)
    sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "Unknown target: $1" >&2
    echo "Expected: backend|frontend|migrate|seed|test:schema|psql|all" >&2
    exit 1
    ;;
esac
