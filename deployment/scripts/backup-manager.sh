#!/usr/bin/env bash
# Glide-HIMS backup manager
# Daily encrypted PostgreSQL dump + uploads tarball with N-day retention.
# Designed to run inside the `backup` Docker service via cron, but also works
# standalone on bare metal. Idempotent and safe to re-invoke.
#
# Env vars (all optional with sane defaults):
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE   – Postgres connection
#   BACKUP_DIR                               – default /backups
#   UPLOADS_DIR                              – default /app/uploads (skip if missing)
#   BACKUP_RETENTION_DAYS                    – default 90
#   BACKUP_ENCRYPTION_KEY                    – if set, dumps GPG-encrypted (symmetric)
#
# Usage:
#   backup-manager.sh                  # take a backup now
#   backup-manager.sh --list           # list existing backups
#   backup-manager.sh --verify <file>  # check checksum + GPG integrity
#   backup-manager.sh --cleanup        # only run retention pruning

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-/app/uploads}"
RETAIN="${BACKUP_RETENTION_DAYS:-90}"
PGDATABASE="${PGDATABASE:-glide_hims}"
PGUSER="${PGUSER:-glide_hims}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }

cleanup() {
  log "Pruning backups older than ${RETAIN} days"
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hims-*.sql.gz*' -mtime +"$RETAIN" -print -delete
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hims-uploads-*.tar.gz*' -mtime +"$RETAIN" -print -delete
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hims-*.sha256' -mtime +"$RETAIN" -print -delete
}

list_backups() {
  printf '%-32s %-12s %s\n' 'FILE' 'SIZE' 'MTIME'
  for f in hims-*.sql.gz* hims-uploads-*.tar.gz*; do
    [[ -e "$f" ]] || continue
    size=$(du -h "$f" | awk '{print $1}')
    mtime=$(stat -c %y "$f" 2>/dev/null | cut -d. -f1)
    printf '%-32s %-12s %s\n' "$f" "$size" "$mtime"
  done
}

verify() {
  local f="$1"
  [[ -f "$f.sha256" ]] || { echo "Missing checksum: $f.sha256"; exit 2; }
  sha256sum -c "$f.sha256" || { echo "CHECKSUM MISMATCH"; exit 3; }
  if [[ "$f" == *.gpg ]]; then
    [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]] || { echo "BACKUP_ENCRYPTION_KEY required to verify GPG"; exit 4; }
    echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 --decrypt "$f" >/dev/null \
      && echo "GPG OK" || { echo "GPG verification failed"; exit 5; }
  fi
  echo "✅ $f verified"
}

case "${1:-}" in
  --list)    list_backups; exit 0 ;;
  --verify)  shift; verify "${1:?file required}"; exit 0 ;;
  --cleanup) cleanup; exit 0 ;;
esac

# --- Take a backup ---
DB_DUMP="hims-db-${TS}.sql.gz"
log "Dumping database $PGDATABASE → $DB_DUMP"
pg_dump --format=plain --no-owner --no-privileges --clean --if-exists "$PGDATABASE" \
  | gzip -9 > "$DB_DUMP"

if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  log "Encrypting $DB_DUMP with GPG (AES256)"
  echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 \
    --symmetric --cipher-algo AES256 -o "${DB_DUMP}.gpg" "$DB_DUMP"
  rm -f "$DB_DUMP"
  DB_DUMP="${DB_DUMP}.gpg"
fi

sha256sum "$DB_DUMP" > "${DB_DUMP}.sha256"
log "DB backup: $DB_DUMP ($(du -h "$DB_DUMP" | awk '{print $1}'))"

if [[ -d "$UPLOADS_DIR" ]] && [[ -n "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]]; then
  UP_TAR="hims-uploads-${TS}.tar.gz"
  log "Archiving uploads → $UP_TAR"
  tar -C "$UPLOADS_DIR" -czf "$UP_TAR" . 2>/dev/null
  if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
    echo "$BACKUP_ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 \
      --symmetric --cipher-algo AES256 -o "${UP_TAR}.gpg" "$UP_TAR"
    rm -f "$UP_TAR"
    UP_TAR="${UP_TAR}.gpg"
  fi
  sha256sum "$UP_TAR" > "${UP_TAR}.sha256"
  log "Uploads backup: $UP_TAR ($(du -h "$UP_TAR" | awk '{print $1}'))"
fi

cleanup
log "✅ Backup complete"
