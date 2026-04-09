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
BACKUP_PASSPHRASE_FILE="${BACKUP_PASSPHRASE_FILE:-/root/.glide-hims-backup-passphrase}"
RETENTION_DAILY=7      # Keep daily backups for 7 days
RETENTION_WEEKLY=30    # Keep weekly backups for 30 days
RETENTION_MANUAL=90    # Keep manual backups for 90 days

# Load .env if exists (safe parsing)
ENV_FILE="$(dirname "$0")/../packages/backend/.env"
if [ -f "$ENV_FILE" ]; then
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ -z "$key" || "$key" =~ ^# ]] && continue
        # Remove surrounding quotes from value
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        case "$key" in
            DB_HOST) DB_HOST="$value" ;;
            DB_PORT) DB_PORT="$value" ;;
            DB_NAME) DB_NAME="$value" ;;
            DB_USERNAME) DB_USER="$value" ;;
            DB_PASSWORD) DB_PASSWORD="$value" ;;
        esac
    done < "$ENV_FILE"
fi

BACKUP_TYPE="${1:-manual}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_SUBDIR="${BACKUP_DIR}/${BACKUP_TYPE}"
BACKUP_FILE="${BACKUP_SUBDIR}/glide_hims_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"

# Create backup directory with secure permissions
mkdir -p "$BACKUP_SUBDIR" && chmod 700 "$BACKUP_DIR"

echo "[$(date)] Starting ${BACKUP_TYPE} backup..."

# Create temporary .pgpass file instead of using PGPASSWORD env var
PGPASS_FILE=$(mktemp "${BACKUP_DIR}/.pgpass.XXXXXX")
chmod 600 "$PGPASS_FILE"
echo "${DB_HOST}:${DB_PORT}:${DB_NAME}:${DB_USER}:${DB_PASSWORD:-}" > "$PGPASS_FILE"
export PGPASSFILE="$PGPASS_FILE"

# Perform backup with compression
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="${BACKUP_FILE%.gz}" 2>/dev/null; then

    # Get file size
    BACKUP_SIZE=$(du -h "${BACKUP_FILE%.gz}" | cut -f1)
    echo "[$(date)] Backup completed: ${BACKUP_FILE%.gz} (${BACKUP_SIZE})"

    # Generate SHA-256 checksum
    sha256sum "${BACKUP_FILE%.gz}" > "${BACKUP_FILE%.gz}.sha256"

    # Encrypt backup if passphrase file exists
    if [ -f "$BACKUP_PASSPHRASE_FILE" ]; then
        gpg --batch --yes --symmetric --cipher-algo AES256 \
            --passphrase-file "$BACKUP_PASSPHRASE_FILE" "${BACKUP_FILE%.gz}"
        rm -f "${BACKUP_FILE%.gz}"
        BACKUP_FILE="${BACKUP_FILE%.gz}.gpg"
        echo "[$(date)] Backup encrypted: ${BACKUP_FILE}"
    else
        echo "[$(date)] WARNING: No passphrase file at ${BACKUP_PASSPHRASE_FILE}, backup is NOT encrypted"
    fi
else
    rm -f "$PGPASS_FILE"
    echo "[$(date)] ERROR: Backup failed!" >&2
    exit 1
fi

# Clean up .pgpass file
rm -f "$PGPASS_FILE"
unset PGPASSFILE

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
