#!/usr/bin/env bash
# Roll back the `current` symlink to a previous release.
# Usage: ./rollback.sh                        — uses $ROOT/.previous-release
#        ./rollback.sh <release-dir>          — explicit absolute path
#        ./rollback.sh --list                 — list available releases
#
# Code-only rollback. To restore the DB, use deploy/db-restore.sh with the
# pg_dump made automatically before the bad deploy.
set -euo pipefail

ROOT="${GLIDE_ROOT:-/root/glide-Hims}"

if [ "${1:-}" = "--list" ]; then
  echo "Available releases (newest last):"
  ls -1tr "$ROOT/releases" 2>/dev/null | sed 's/^/  /'
  echo
  echo "Currently active:"
  readlink -f "$ROOT/current" 2>/dev/null | sed 's/^/  /' || echo "  (no current symlink)"
  exit 0
fi

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  TARGET=$(cat "$ROOT/.previous-release" 2>/dev/null || true)
fi

# Allow passing a relative release name like "main_abc123ef"
if [ -n "$TARGET" ] && [ ! -d "$TARGET" ] && [ -d "$ROOT/releases/$TARGET" ]; then
  TARGET="$ROOT/releases/$TARGET"
fi

if [ -z "$TARGET" ] || [ ! -d "$TARGET" ]; then
  echo "✗ No valid rollback target." >&2
  echo "  Try: $0 --list" >&2
  exit 1
fi

CURRENT=$(readlink -f "$ROOT/current" 2>/dev/null || true)
if [ "$CURRENT" = "$TARGET" ]; then
  echo "Already on $TARGET — nothing to do."
  exit 0
fi

echo "▶ Rolling back: $CURRENT → $TARGET"
ln -snf "$TARGET" "$ROOT/.current.new"
mv -Tf "$ROOT/.current.new" "$ROOT/current"
echo "$CURRENT" > "$ROOT/.previous-release"

echo "▶ Reloading PM2"
pm2 reload "$ROOT/current/ecosystem.config.js" --update-env
pm2 save >/dev/null

echo "✅ Rolled back to $(readlink -f "$ROOT/current")"
echo "   Previous (now): $CURRENT"
echo
echo "If you need to roll back the DB too:"
echo "   ls $ROOT/shared/backups/   # find the pre-* dump made before the bad deploy"
echo "   $ROOT/deploy/db-restore.sh <backup.sql.gz>"
