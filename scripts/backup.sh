#!/bin/bash
# Glide-HIMS Database Backup Script
# Usage: ./scripts/backup.sh [daily|weekly|manual]
# Schedule with cron:
#   0 2 * * * /root/glide-Hims/scripts/backup.sh daily
#   0 3 * * 0 /root/glide-Hims/scripts/backup.sh weekly

set -euo pipefail

# Configuration — override via environment variables
BACKUP_DIR="${BACKUP_DIR:-/root/glide-Hims/backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-glide_hims}"
DB_USER="${DB_USER:-glide_hims}"
RETENTION_DAILY=7      # Keep daily backups for 7 days
RETENTION_WEEKLY=30    # Keep weekly backups for 30 days
RETENTION_MANUAL=90    # Keep manual backups for 90 days

# Load .env if exists
ENV_FILE="$(dirname "$0")/../packages/backend/.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -E '^DB_(HOST|PORT|NAME|USERNAME|PASSWORD)=' "$ENV_FILE" | sed 's/DB_USERNAME/DB_USER/' | xargs)
    # Map .env variable names
    DB_HOST="${DB_HOST:-localhost}"
    DB_USER="${DB_USER:-${DB_USERNAME:-glide_hims}}"
    DB_NAME="${DB_NAME:-glide_hims}"
fi

BACKUP_TYPE="${1:-manual}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_SUBDIR="${BACKUP_DIR}/${BACKUP_TYPE}"
BACKUP_FILE="${BACKUP_SUBDIR}/glide_hims_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_SUBDIR"

echo "[$(date)] Starting ${BACKUP_TYPE} backup..."

# Set password for pg_dump
export PGPASSWORD="${DB_PASSWORD:-}"

# Perform backup with compression
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="${BACKUP_FILE%.gz}" 2>/dev/null; then

    # Get file size
    BACKUP_SIZE=$(du -h "${BACKUP_FILE%.gz}" | cut -f1)
    echo "[$(date)] Backup completed: ${BACKUP_FILE%.gz} (${BACKUP_SIZE})"
else
    echo "[$(date)] ERROR: Backup failed!" >&2
    exit 1
fi

# Clean up old backups based on retention policy
case "$BACKUP_TYPE" in
    daily)
        RETENTION=$RETENTION_DAILY
        ;;
    weekly)
        RETENTION=$RETENTION_WEEKLY
        ;;
    manual)
        RETENTION=$RETENTION_MANUAL
        ;;
    *)
        RETENTION=$RETENTION_MANUAL
        ;;
esac

echo "[$(date)] Cleaning up backups older than ${RETENTION} days..."
find "$BACKUP_SUBDIR" -name "glide_hims_${BACKUP_TYPE}_*" -mtime +"$RETENTION" -delete 2>/dev/null || true

# Count remaining backups
REMAINING=$(find "$BACKUP_SUBDIR" -name "glide_hims_${BACKUP_TYPE}_*" | wc -l)
echo "[$(date)] Backup complete. ${REMAINING} ${BACKUP_TYPE} backup(s) retained."

unset PGPASSWORD
