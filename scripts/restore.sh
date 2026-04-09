#!/bin/bash
# Glide-HIMS Database Restore Script
# Usage: ./scripts/restore.sh <backup_file>

set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    find "$(dirname "$0")/../backups" -name "glide_hims_*" -type f | sort -r | head -20
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Verify backup integrity
if [ -f "${BACKUP_FILE}.sha256" ]; then
    echo "[$(date)] Verifying backup integrity..."
    sha256sum -c "${BACKUP_FILE}.sha256" || { echo "Backup integrity check failed!"; exit 1; }
    echo "[$(date)] Backup integrity verified."
fi

# Decrypt if encrypted
RESTORE_FILE="$BACKUP_FILE"
BACKUP_PASSPHRASE_FILE="${BACKUP_PASSPHRASE_FILE:-/root/.glide-hims-backup-passphrase}"
if [[ "$BACKUP_FILE" == *.gpg ]]; then
    if [ ! -f "$BACKUP_PASSPHRASE_FILE" ]; then
        echo "ERROR: Encrypted backup requires passphrase file at ${BACKUP_PASSPHRASE_FILE}"
        exit 1
    fi
    RESTORE_FILE="${BACKUP_FILE%.gpg}"
    gpg --batch --yes --decrypt --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
        --output "$RESTORE_FILE" "$BACKUP_FILE"
    echo "[$(date)] Backup decrypted."
fi

# Load .env (safe parsing)
ENV_FILE="$(dirname "$0")/../packages/backend/.env"
if [ -f "$ENV_FILE" ]; then
    while IFS='=' read -r key value; do
        [[ -z "$key" || "$key" =~ ^# ]] && continue
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

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-glide_hims}"
DB_USER="${DB_USER:-glide_hims}"

# Create temporary .pgpass file
PGPASS_FILE=$(mktemp "$(dirname "$0")/../.pgpass.XXXXXX")
chmod 600 "$PGPASS_FILE"
echo "${DB_HOST}:${DB_PORT}:${DB_NAME}:${DB_USER}:${DB_PASSWORD:-}" > "$PGPASS_FILE"
export PGPASSFILE="$PGPASS_FILE"

echo "⚠️  WARNING: This will overwrite the database '${DB_NAME}' on ${DB_HOST}:${DB_PORT}"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    rm -f "$PGPASS_FILE"
    [ "$RESTORE_FILE" != "$BACKUP_FILE" ] && rm -f "$RESTORE_FILE"
    echo "Restore cancelled."
    exit 0
fi

echo "[$(date)] Restoring from: $BACKUP_FILE"

pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --clean --if-exists --verbose \
    "$RESTORE_FILE" 2>&1 | tail -5

echo "[$(date)] Restore completed successfully."

# Clean up
rm -f "$PGPASS_FILE"
unset PGPASSFILE
[ "$RESTORE_FILE" != "$BACKUP_FILE" ] && rm -f "$RESTORE_FILE"
