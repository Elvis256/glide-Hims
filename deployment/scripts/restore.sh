#!/usr/bin/env bash
# Glide-HIMS restore tool
# Restores a database backup (and optionally an uploads archive) created by
# backup-manager.sh. Verifies SHA-256 + GPG before touching the live database.
#
# Usage:
#   restore.sh --db hims-db-20260427T020000Z.sql.gz.gpg
#   restore.sh --db <file> --uploads <file>      # restore both
#   restore.sh --db <file> --target glide_hims_restore   # restore to a different DB
#   restore.sh --list                                    # show available backups

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"
PGDATABASE="${PGDATABASE:-glide_hims}"
DB_FILE=""; UP_FILE=""; TARGET_DB=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db)       DB_FILE="$2"; shift 2 ;;
    --uploads)  UP_FILE="$2"; shift 2 ;;
    --target)   TARGET_DB="$2"; shift 2 ;;
    --list)     ls -lh "$BACKUP_DIR"/hims-*.{sql.gz,sql.gz.gpg,tar.gz,tar.gz.gpg} 2>/dev/null; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -n "$DB_FILE" ]] || { echo "--db is required"; exit 1; }
TARGET_DB="${TARGET_DB:-$PGDATABASE}"

cd "$BACKUP_DIR"
log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }

verify() {
  local f="$1"
  [[ -f "$f" ]] || { echo "Missing: $f"; exit 2; }
  [[ -f "$f.sha256" ]] && sha256sum -c "$f.sha256" || { echo "Checksum failed for $f"; exit 3; }
}

decrypt_if_needed() {
  local f="$1"
  if [[ "$f" == *.gpg ]]; then
    [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]] || { echo "BACKUP_ENCRYPTION_KEY required"; exit 4; }
    local out="${f%.gpg}"
    echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 -o "$out" --decrypt "$f"
    echo "$out"
  else
    echo "$f"
  fi
}

log "Verifying $DB_FILE"
verify "$DB_FILE"
PLAIN_DB=$(decrypt_if_needed "$DB_FILE")

log "Restoring database to '$TARGET_DB' (existing data will be overwritten)"
read -rp "Type 'YES' to confirm: " confirm
[[ "$confirm" == "YES" ]] || { echo "Cancelled"; exit 0; }

# Drop & recreate target DB
psql -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$TARGET_DB' AND pid<>pg_backend_pid();
DROP DATABASE IF EXISTS $TARGET_DB;
CREATE DATABASE $TARGET_DB OWNER $PGUSER;
SQL

gunzip -c "$PLAIN_DB" | psql -v ON_ERROR_STOP=1 -d "$TARGET_DB"

[[ "$PLAIN_DB" != "$DB_FILE" ]] && rm -f "$PLAIN_DB"
log "✅ Database restored"

if [[ -n "$UP_FILE" ]]; then
  log "Verifying $UP_FILE"
  verify "$UP_FILE"
  PLAIN_UP=$(decrypt_if_needed "$UP_FILE")
  log "Extracting uploads to $UPLOADS_DIR"
  mkdir -p "$UPLOADS_DIR"
  tar -C "$UPLOADS_DIR" -xzf "$PLAIN_UP"
  [[ "$PLAIN_UP" != "$UP_FILE" ]] && rm -f "$PLAIN_UP"
  log "✅ Uploads restored"
fi

log "Restart the backend to pick up restored data:  docker compose restart backend"
