#!/usr/bin/env bash
# One-time migration of an existing /root/glide-Hims into the release-dir layout.
# Idempotent — safe to run multiple times.
#
# After this:
#   /root/glide-Hims/repo/             — bare-ish source for git operations
#   /root/glide-Hims/releases/<ref>/   — built releases
#   /root/glide-Hims/shared/.env       — backend env
#   /root/glide-Hims/shared/uploads/   — never wiped
#   /root/glide-Hims/current → releases/<ref>
#
# Usage: ./bootstrap.sh <ref>
#   <ref> = the git ref to materialize as the first release (e.g. main, v1.0.0)
set -euo pipefail

ROOT="${GLIDE_ROOT:-/root/glide-Hims}"
REF="${1:-main}"
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
LEGACY="$ROOT"

log() { printf "\033[1;36m▶ %s\033[0m\n" "$*"; }

# 1. Move the existing checkout into repo/ if not already done
if [ ! -d "$ROOT/repo/.git" ]; then
  log "Relocating existing checkout to $ROOT/repo/"
  mkdir -p "$ROOT/repo"
  # Move git metadata + everything except releases/shared/current/repo
  shopt -s dotglob
  for f in "$ROOT"/*; do
    name=$(basename "$f")
    case "$name" in
      releases|shared|current|repo|.previous-release|.current.new) continue ;;
    esac
    mv "$f" "$ROOT/repo/"
  done
  shopt -u dotglob
fi

# 2. Move .env + uploads into shared/
mkdir -p "$ROOT/shared/backups" "$ROOT/shared/uploads"
if [ -f "$ROOT/repo/packages/backend/.env" ] && [ ! -f "$ROOT/shared/.env" ]; then
  log "Promoting packages/backend/.env → shared/.env"
  mv "$ROOT/repo/packages/backend/.env" "$ROOT/shared/.env"
fi
if [ -d "$ROOT/repo/uploads" ] && [ ! -L "$ROOT/repo/uploads" ]; then
  log "Promoting uploads/ → shared/uploads/"
  rsync -a "$ROOT/repo/uploads/" "$ROOT/shared/uploads/"
  rm -rf "$ROOT/repo/uploads"
fi

# 3. Hand off to deploy.sh to materialize the first release
log "Running first deploy of $REF"
chmod +x "$SCRIPTS"/*.sh
"$SCRIPTS/deploy.sh" "$REF"

log "Bootstrap complete."
log "Next: update nginx server-block 'root' to: $ROOT/current/packages/frontend/dist"
log "      then: nginx -t && systemctl reload nginx"
