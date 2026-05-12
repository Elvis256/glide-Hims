#!/usr/bin/env bash
# Restore the DB from a pg_dump custom-format file (.sql.gz) produced by deploy.sh.
# Usage: ./db-restore.sh <backup.sql.gz>
set -euo pipefail

ROOT="${GLIDE_ROOT:-/root/glide-Hims}"
BACKUP="${1:?Usage: db-restore.sh <backup.sql.gz>}"

if [ ! -f "$BACKUP" ]; then
  echo "✗ Backup not found: $BACKUP" >&2
  exit 1
fi

DB_USER=$(grep -E '^DB_USERNAME=' "$ROOT/shared/.env" | tail -1 | cut -d= -f2-)
DB_PASS=$(grep -E '^DB_PASSWORD=' "$ROOT/shared/.env" | tail -1 | cut -d= -f2-)
DB_NAME=$(grep -E '^DB_NAME=' "$ROOT/shared/.env" | tail -1 | cut -d= -f2-)
DB_HOST=$(grep -E '^DB_HOST=' "$ROOT/shared/.env" | tail -1 | cut -d= -f2-)
DB_HOST="${DB_HOST:-localhost}"

echo "▶ This will DESTROY the current $DB_NAME on $DB_HOST and replace it with $BACKUP"
read -r -p "  Type the DB name '$DB_NAME' to confirm: " confirm
[ "$confirm" = "$DB_NAME" ] || { echo "Aborted."; exit 1; }

# Take a defensive snapshot of current state first
TS=$(date +%Y%m%d-%H%M%S)
SAFETY="$ROOT/shared/backups/pre-restore_${TS}.sql.gz"
echo "▶ Snapshotting current DB → $SAFETY"
PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -U "$DB_USER" -F c "$DB_NAME" | gzip > "$SAFETY"

echo "▶ Stopping backend so no writes happen during restore"
pm2 stop glide-hims-backend >/dev/null

echo "▶ Dropping and recreating $DB_NAME"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

echo "▶ Restoring $BACKUP"
gunzip -c "$BACKUP" | PGPASSWORD="$DB_PASS" pg_restore -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges 2>&1 | tail -5

echo "▶ Restarting backend"
pm2 start glide-hims-backend

echo "✅ Restored $DB_NAME from $BACKUP"
echo "   Pre-restore safety snapshot: $SAFETY"
