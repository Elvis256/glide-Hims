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
# The role the dump runs as. It needs BYPASSRLS or the superuser bit, because a
# role without it aborts on the first table carrying a policy. Overridable so
# this script is testable on installs whose superuser is not called `postgres`.
DUMP_SUPERUSER="${DUMP_SUPERUSER:-postgres}"
# Resolve the binaries here, not inside sudo. sudo resets PATH, so a Postgres
# installed outside the system path — which is exactly how this project's own
# machines are set up — makes `sudo -u postgres pg_dump` fail with "command not
# found" and nothing else.
PG_DUMP_BIN="${PG_DUMP_BIN:-$(command -v pg_dump || true)}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-$(command -v pg_restore || true)}"
if [ -z "$PG_DUMP_BIN" ] || [ -z "$PG_RESTORE_BIN" ]; then
    echo "[$(date)] ERROR: pg_dump/pg_restore not on PATH. Set PG_DUMP_BIN and PG_RESTORE_BIN." >&2
    exit 1
fi
# A dump smaller than this is treated as a failure. The truncated dumps this
# script used to produce were ~1.3 MB and looked entirely plausible next to a
# real one; a floor is the cheapest way to notice.
MIN_DUMP_BYTES="${MIN_DUMP_BYTES:-262144}"
RETENTION_DAILY=7      # Keep daily backups for 7 days
RETENTION_WEEKLY=30    # Keep weekly backups for 30 days
RETENTION_MANUAL=90    # Keep manual backups for 90 days

# Which settings the caller pinned in the environment. The header of this file
# promises "override via environment variables", and the loop below broke that
# promise: it assigned every key it found in .env unconditionally, so an
# operator passing DB_PORT=5433 got 5432 anyway and a confusing "socket
# /tmp/.s.PGSQL.5432 not found". .env is a default source, not an authority.
_ENV_PINNED_HOST="${DB_HOST+set}"
_ENV_PINNED_PORT="${DB_PORT+set}"
_ENV_PINNED_NAME="${DB_NAME+set}"
_ENV_PINNED_USER="${DB_USER+set}"

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
            DB_HOST) [ -z "$_ENV_PINNED_HOST" ] && DB_HOST="$value" ;;
            DB_PORT) [ -z "$_ENV_PINNED_PORT" ] && DB_PORT="$value" ;;
            DB_NAME) [ -z "$_ENV_PINNED_NAME" ] && DB_NAME="$value" ;;
            DB_USERNAME) [ -z "$_ENV_PINNED_USER" ] && DB_USER="$value" ;;
            DB_PASSWORD) DB_PASSWORD="$value" ;;
        esac || true
    done < "$ENV_FILE"
fi

BACKUP_TYPE="${1:-manual}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_SUBDIR="${BACKUP_DIR}/${BACKUP_TYPE}"
BACKUP_FILE="${BACKUP_SUBDIR}/glide_hims_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"

# Create backup directory with secure permissions
mkdir -p "$BACKUP_SUBDIR" && chmod 700 "$BACKUP_DIR"

echo "[$(date)] Starting ${BACKUP_TYPE} backup..."

# Dump as the postgres superuser via local peer auth: no credentials needed,
# and app-role dumps fail against tables with row-level security policies.
# Dump to a temp file postgres can write, then move into the root-only backup dir.
DUMP_TMP=$(mktemp /tmp/glide_hims_dump.XXXXXX)
if ! chown "$DUMP_SUPERUSER":"$DUMP_SUPERUSER" "$DUMP_TMP"; then
    rm -f "$DUMP_TMP"
    echo "[$(date)] ERROR: cannot hand the dump file to postgres — run this script as root." >&2
    exit 1
fi

# On any failure below, drop whichever of the two paths still exists so a
# truncated dump is never left behind under a valid backup name: pg_dump
# writes a partial file even when it aborts on an RLS error.
cleanup_failed_dump() {
    rm -f "$DUMP_TMP" "${BACKUP_FILE%.gz}"
}

# A backup holds every patient record in the system, so it is chmod 600 and
# owned by root. The chown needs root, which cron has; a human verifying the
# script by hand does not, and failing there made the whole thing untestable
# without sudo. Permissions are still tightened either way — only the change of
# owner is skipped, with a warning, so the file is never left world-readable.
harden_backup_file() {
    chmod 600 "$1" || return 1
    if [ "$(id -u)" -eq 0 ]; then
        chown root:root "$1" || return 1
    else
        echo "[$(date)] WARNING: not root — backup left owned by $(id -un), not root." >&2
    fi
}

if sudo -u "$DUMP_SUPERUSER" "$PG_DUMP_BIN" -p "$DB_PORT" -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --file="$DUMP_TMP" \
    && mv "$DUMP_TMP" "${BACKUP_FILE%.gz}" && harden_backup_file "${BACKUP_FILE%.gz}"; then

    # A file is not a backup until something has read it back.
    #
    # This script once produced truncated dumps that carried a valid backup
    # name, and nobody found out for three months, because "pg_dump exited 0"
    # was the only thing ever checked. Two cheap gates close that: a size floor,
    # and pg_restore actually parsing the archive's table of contents. A
    # truncated custom-format dump fails the second one immediately.
    DUMP_BYTES=$(stat -c%s "${BACKUP_FILE%.gz}")
    if [ "$DUMP_BYTES" -lt "$MIN_DUMP_BYTES" ]; then
        rm -f "${BACKUP_FILE%.gz}"
        echo "[$(date)] ERROR: dump is only ${DUMP_BYTES} bytes (floor ${MIN_DUMP_BYTES}) — refusing to keep it." >&2
        exit 1
    fi
    if ! TOC_ENTRIES=$("$PG_RESTORE_BIN" --list "${BACKUP_FILE%.gz}" 2>&1 | grep -c '^[0-9]'); then
        rm -f "${BACKUP_FILE%.gz}"
        echo "[$(date)] ERROR: pg_restore cannot read the dump — it is not restorable. Discarded." >&2
        exit 1
    fi
    if [ "${TOC_ENTRIES:-0}" -lt 50 ]; then
        rm -f "${BACKUP_FILE%.gz}"
        echo "[$(date)] ERROR: dump lists only ${TOC_ENTRIES} objects — truncated. Discarded." >&2
        exit 1
    fi

    # Get file size
    BACKUP_SIZE=$(du -h "${BACKUP_FILE%.gz}" | cut -f1)
    echo "[$(date)] Backup verified restorable: ${TOC_ENTRIES} objects, ${BACKUP_SIZE}"
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
    cleanup_failed_dump
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

# Heartbeat. The cron job failed nightly for a hundred days and the only trace
# was a line in a log nobody opens. This file's mtime is a single thing a
# monitor, or a person, can check: if it is stale, backups have stopped —
# whatever the reason, and without needing to parse a log.
HEARTBEAT="${BACKUP_DIR}/last-successful-${BACKUP_TYPE}"
date -u +%Y-%m-%dT%H:%M:%SZ > "$HEARTBEAT"
echo "[$(date)] Heartbeat written: ${HEARTBEAT}"
