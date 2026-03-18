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

# Load .env
ENV_FILE="$(dirname "$0")/../packages/backend/.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -E '^DB_(HOST|PORT|NAME|USERNAME|PASSWORD)=' "$ENV_FILE" | sed 's/DB_USERNAME/DB_USER/' | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-glide_hims}"
DB_USER="${DB_USER:-${DB_USERNAME:-glide_hims}}"
export PGPASSWORD="${DB_PASSWORD:-}"

echo "⚠️  WARNING: This will overwrite the database '${DB_NAME}' on ${DB_HOST}:${DB_PORT}"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "[$(date)] Restoring from: $BACKUP_FILE"

pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --clean --if-exists --verbose \
    "$BACKUP_FILE" 2>&1 | tail -5

echo "[$(date)] Restore completed successfully."
unset PGPASSWORD
