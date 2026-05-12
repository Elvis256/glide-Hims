#!/usr/bin/env bash
# Deploy a git ref (tag or branch) to the current host.
# Usage: ./deploy.sh <ref>
#   <ref> = git tag (e.g. v1.4.0) or branch name (e.g. main)
#
# Layout it expects/creates:
#   $ROOT/repo/                 — source clone, used only for git operations
#   $ROOT/releases/<ref>_<sha>/ — full materialized release with built dist/
#   $ROOT/shared/.env           — backend env (single source, shared by all releases)
#   $ROOT/shared/uploads/       — never wiped between releases
#   $ROOT/shared/backups/       — pg_dump per release (pre-migration snapshot)
#   $ROOT/current               — symlink to the active release
set -euo pipefail

ROOT="${GLIDE_ROOT:-/root/glide-Hims}"
REF="${1:?Usage: deploy.sh <git-ref>}"
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"

REPO="$ROOT/repo"
SHARED="$ROOT/shared"
RELEASES="$ROOT/releases"

mkdir -p "$RELEASES" "$SHARED/backups" "$SHARED/uploads"

log() { printf "\033[1;36m▶ %s\033[0m\n" "$*"; }
err() { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; }

# 1. Sync repo
log "Fetching $REF from origin"
cd "$REPO"
git fetch --all --tags --prune --quiet
# Prefer origin/<ref> for branches (local branch ref isn't advanced by `fetch`).
# Fall back to the bare ref so tags and explicit SHAs still resolve.
if git rev-parse --verify --quiet "origin/$REF^{commit}" >/dev/null; then
  SHA=$(git rev-parse "origin/$REF^{commit}")
else
  SHA=$(git rev-parse "${REF}^{commit}")
fi
SHORT=$(git rev-parse --short=8 "$SHA")
TARGET="$RELEASES/${REF//\//-}_${SHORT}"
log "Resolved $REF → $SHA"

# 2. Materialize release dir (skip if already exists)
if [ -d "$TARGET" ]; then
  log "Release dir already exists: $TARGET (re-using)"
else
  log "Creating release at $TARGET"
  mkdir -p "$TARGET"
  git --work-tree="$TARGET" checkout "$SHA" -- .
  echo "$SHA" > "$TARGET/.RELEASE_SHA"
  echo "$REF" > "$TARGET/.RELEASE_REF"
  date -Iseconds > "$TARGET/.RELEASE_DATE"
fi

# 3. Wire shared resources
log "Linking shared .env and uploads"
mkdir -p "$TARGET/packages/backend"
ln -snf "$SHARED/.env" "$TARGET/packages/backend/.env"
rm -rf "$TARGET/uploads"
ln -snf "$SHARED/uploads" "$TARGET/uploads"

# 4. Install + build
log "pnpm install"
cd "$TARGET"
pnpm install --prefer-offline --frozen-lockfile 2>&1 | tail -3

log "Building backend"
( cd packages/backend && pnpm build 2>&1 | tail -3 )

log "Building frontend"
( cd packages/frontend && pnpm build 2>&1 | tail -3 )

# 5. DB backup before migration
TS=$(date +%Y%m%d-%H%M%S)
BACKUP="$SHARED/backups/pre-${REF//\//-}_${SHORT}_${TS}.sql.gz"
DB_USER=$(grep -E '^DB_USERNAME=' "$SHARED/.env" | tail -1 | cut -d= -f2-)
DB_PASS=$(grep -E '^DB_PASSWORD=' "$SHARED/.env" | tail -1 | cut -d= -f2-)
DB_NAME=$(grep -E '^DB_NAME=' "$SHARED/.env" | tail -1 | cut -d= -f2-)
DB_HOST=$(grep -E '^DB_HOST=' "$SHARED/.env" | tail -1 | cut -d= -f2-)
DB_HOST="${DB_HOST:-localhost}"
log "Backing up $DB_NAME → $BACKUP"
PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -U "$DB_USER" -F c "$DB_NAME" | gzip > "$BACKUP"

# 6. Migrations (TypeORM, dotenv-first wrapper)
log "Running TypeORM migrations"
cd "$TARGET/packages/backend"
cat > _runmig.ts <<'TS'
import { config } from 'dotenv'; config();
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from './src/config/database.factory';
const ds = new DataSource(getDatabaseConfig(false));
export default ds;
TS
if ! pnpm typeorm migration:run -d _runmig.ts 2>&1 | tail -8; then
  rm -f _runmig.ts
  err "Migration failed — release NOT activated. Backup: $BACKUP"
  exit 2
fi
rm -f _runmig.ts

# 7. Atomic symlink swap
PREV=""
[ -L "$ROOT/current" ] && PREV=$(readlink -f "$ROOT/current")
log "Activating release (symlink swap)"
ln -snf "$TARGET" "$ROOT/.current.new"
mv -Tf "$ROOT/.current.new" "$ROOT/current"
echo "$PREV" > "$ROOT/.previous-release"

# 8. PM2 reload
log "Reloading PM2"
cd "$ROOT/current"
if pm2 jlist 2>/dev/null | grep -q glide-hims-backend; then
  pm2 reload "$ROOT/current/ecosystem.config.js" --update-env
else
  pm2 start "$ROOT/current/ecosystem.config.js"
fi
pm2 save >/dev/null

# 9. Smoke test
log "Waiting for backend to settle"
sleep 15
log "Smoke test"
if "$SCRIPTS/smoke.sh"; then
  log "✅ Deploy successful: $REF ($SHORT)"
  log "   Previous: ${PREV:-none}"
  log "   DB backup: $BACKUP"
  exit 0
else
  err "Smoke test failed — auto-rolling back"
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    "$SCRIPTS/rollback.sh" "$PREV"
    err "Rolled back to $PREV. Investigate logs at: pm2 logs glide-hims-backend"
  else
    err "No previous release to roll back to"
  fi
  exit 3
fi
