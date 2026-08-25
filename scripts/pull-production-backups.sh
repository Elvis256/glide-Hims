#!/usr/bin/env bash
#
# Pull production's database backups onto this machine.
#
# Why this exists: every backup of the hospital database lived on production's
# own /dev/sda1, alongside the database it is a backup of. /mnt/offsite on that
# host looks like an offsite target and is an empty directory on the same disk.
# One disk failure, one ransomware event, one provider incident took the
# database and every copy of it together.
#
# This does not make the backups good — it makes them exist in two places.
# Encryption is a separate question and should come after this, with the
# passphrase held somewhere that is neither host.
#
# Usage:
#     bash scripts/pull-production-backups.sh          # pull, verify, prune
#     bash scripts/pull-production-backups.sh --check  # connectivity only
#
# Runs from cron on the pulling machine, so it is quiet on success and loud on
# failure: anything written to stdout ends up in the log, and a non-zero exit
# is what makes a silent failure visible.

set -Eeuo pipefail

REMOTE="${REMOTE:-root@100.72.241.13}"
REMOTE_DIR="${REMOTE_DIR:-/root/glide-Hims/backups}"
LOCAL_DIR="${LOCAL_DIR:-$HOME/glide-hims-offsite}"
KEEP_DAYS="${KEEP_DAYS:-45}"
MIN_BYTES="${MIN_BYTES:-1000000}"   # a real dump is megabytes; a truncated one is not

log() { echo "[$(date -Is)] $*"; }
die() { echo "[$(date -Is)] FAILED: $*" >&2; exit 1; }

# One at a time. Two rsyncs into the same tree can interleave partial files,
# and a deploy earlier today went down precisely because nothing stopped two
# copies of the same job from running at once.
LOCK="/tmp/glide-backup-pull.lock"
exec 9>"$LOCK" || die "cannot open $LOCK"
flock -n 9 || { log "another pull is already running; exiting"; exit 0; }

command -v rsync >/dev/null || die "rsync not installed"

ssh -o BatchMode=yes -o ConnectTimeout=15 "$REMOTE" true 2>/dev/null \
  || die "cannot reach $REMOTE over ssh (BatchMode: needs a working key, no prompt)"

if [ "${1:-}" = "--check" ]; then
  log "connectivity to $REMOTE OK; would pull $REMOTE_DIR -> $LOCAL_DIR"
  exit 0
fi

mkdir -p "$LOCAL_DIR"

# ------------------------------------------------------------------- pull ---
# --ignore-existing is deliberate: backups are immutable once written, so a
# file that is already here does not need re-fetching, and re-fetching is how
# a good local copy gets overwritten by a truncated remote one mid-write.
log "pulling from $REMOTE:$REMOTE_DIR"
rsync -az --partial --timeout=120 --ignore-existing \
      --include='*/' \
      --include='*.sql' --include='*.sql.gz' --include='*.gpg' --include='*.sha256' --include='*.dump' \
      --exclude='*' \
      -e 'ssh -o BatchMode=yes -o ConnectTimeout=15' \
      "$REMOTE:$REMOTE_DIR/" "$LOCAL_DIR/" \
  || die "rsync failed"

# ----------------------------------------------------------------- verify ---
# A copy nobody checked is a copy nobody can rely on. Where the backup script
# wrote a .sha256 next to a dump, hold the local copy to it.
# Compare the HASH, not the path. Production writes its .sha256 with the
# absolute remote path baked in (/root/glide-Hims/backups/...), so
# `sha256sum -c` here tries to open a file that does not exist on this machine
# and reports "FAILED open or read" for every single dump — which reads exactly
# like mass corruption and is nothing of the sort.
checked=0; bad=0; orphan=0; encrypted=0
while IFS= read -r sum; do
  f="${sum%.sha256}"
  # An orphaned checksum is an upstream inconsistency, not a transfer failure:
  # production's daily/20260817 has a .sha256 and no dump, cause unknown (the
  # log that would say was rotated away, and backup.sh cannot produce this —
  # it verifies the dump BEFORE writing the checksum). Report it every run so
  # it stays visible, but do not fail the job on it: a nightly that is red
  # forever over a historical artifact is a nightly nobody reads.
  # Once encryption is enabled the plaintext is gone by design: backup.sh
  # hashes the dump, encrypts it, then deletes the plaintext. So .sql.sha256
  # sits beside .sql.gpg with no .sql, which is CORRECT and must not be
  # reported as an orphan — otherwise every backup from that day on looks
  # broken. The hash still verifies after restore.sh decrypts back to that
  # exact filename; it simply cannot be checked here without the passphrase,
  # which this machine deliberately does not hold.
  if [ ! -f "$f" ] && [ -f "$f.gpg" ]; then
    encrypted=$((encrypted+1)); continue
  fi
  [ -f "$f" ] || { echo "  ORPHANED CHECKSUM, no dump: $(basename "$sum")"; orphan=$((orphan+1)); continue; }
  want=$(awk '{print $1}' "$sum" | head -1)
  got=$(sha256sum "$f" | awk '{print $1}')
  if [ -n "$want" ] && [ "$want" = "$got" ]; then
    checked=$((checked+1))
  else
    echo "  CHECKSUM MISMATCH: $f"; bad=$((bad+1))
  fi
done < <(find "$LOCAL_DIR" -name '*.sha256' 2>/dev/null)

# A dump that is suspiciously small is the failure mode a checksum cannot catch,
# because a truncated file hashed at both ends still matches itself.
small=0
while IFS= read -r f; do
  sz=$(stat -c%s "$f")
  [ "$sz" -lt "$MIN_BYTES" ] && { echo "  SUSPICIOUSLY SMALL (${sz}B): $f"; small=$((small+1)); }
done < <(find "$LOCAL_DIR" -name '*.sql' -o -name '*.sql.gz' -o -name '*.gpg' 2>/dev/null | head -200)

TOTAL=$(find "$LOCAL_DIR" -type f \( -name '*.sql' -o -name '*.sql.gz' -o -name '*.gpg' -o -name '*.dump' \) 2>/dev/null | wc -l)
NEWEST=$(find "$LOCAL_DIR" -type f -name '*.sql*' -printf '%T@ %TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-3)

log "held locally: $TOTAL dump(s), newest $NEWEST, $(du -sh "$LOCAL_DIR" 2>/dev/null | cut -f1)"
log "checksums: $checked verified, $bad bad, $encrypted encrypted (not checkable here), $orphan orphaned, $small suspiciously small"

# ------------------------------------------------------------------ prune ---
# Only ever prune the LOCAL copy, and only by age. Production's own retention
# is production's business; this script must never delete anything there.
find "$LOCAL_DIR" -type f -mtime "+$KEEP_DAYS" -delete 2>/dev/null || true
find "$LOCAL_DIR" -type d -empty -delete 2>/dev/null || true

# --------------------------------------------------------------- staleness ---
# The point of this job is that a copy exists off the production host. If the
# newest thing here is old, the job has been failing quietly and that is worth
# a non-zero exit even when today's rsync succeeded.
NEWEST_EPOCH=$(find "$LOCAL_DIR" -type f -name '*.sql*' -printf '%T@\n' 2>/dev/null | sort -rn | head -1 | cut -d. -f1)
if [ -n "${NEWEST_EPOCH:-}" ]; then
  AGE_H=$(( ( $(date +%s) - NEWEST_EPOCH ) / 3600 ))
  [ "$AGE_H" -gt 48 ] && die "newest local backup is ${AGE_H}h old — production's nightly backup may be failing"
fi

[ "$bad" -eq 0 ] || die "$bad checksum mismatch(es)"
[ "$TOTAL" -gt 0 ] || die "no backups present locally after pull"

log "ok"
