#!/usr/bin/env bash
# Glide-HIMS offline update manager
# Applies a pre-downloaded update bundle to a running standalone deployment.
#
# Bundle format (.glide-update.tar.gz):
#   ├── manifest.json          # { "version", "fromVersion": ["1.0.0", ...], "sha256", "createdAt" }
#   ├── image.tar              # `docker save glide-hims:NEW_VERSION`
#   ├── migrations/            # optional SQL migrations applied in lex order
#   └── post-install.sh        # optional hook
#
# Usage:
#   update-manager.sh --check                          # ask central server for new version
#   update-manager.sh --apply ./update-1.1.0.tar.gz    # offline apply
#   update-manager.sh --download 1.1.0                 # download from central (online)
#   update-manager.sh --rollback                       # revert to previous version

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/glide-hims}"
STATE_DIR="${STATE_DIR:-$INSTALL_DIR/.update-state}"
mkdir -p "$STATE_DIR"
COMPOSE="docker compose -f $INSTALL_DIR/docker-compose.yml --env-file $INSTALL_DIR/.env"

log()  { printf '\033[1;34m[%s]\033[0m %s\n' "$(date -u +%T)" "$*"; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

current_version() {
  ( source "$INSTALL_DIR/.env" 2>/dev/null && echo "${HIMS_VERSION:-latest}" )
}

central() {
  ( source "$INSTALL_DIR/.env" 2>/dev/null && echo "${CENTRAL_SERVER_URL:-}" )
}

check_for_update() {
  local url; url=$(central)
  [[ -n "$url" ]] || fail "CENTRAL_SERVER_URL not set in .env"
  log "Asking $url for newer than $(current_version)"
  curl -fsS "$url/api/v1/updates/check?from=$(current_version)" | tee "$STATE_DIR/last-check.json"
}

download() {
  local version="${1:?version required}"
  local url; url=$(central)
  [[ -n "$url" ]] || fail "CENTRAL_SERVER_URL not set in .env"
  local out="$STATE_DIR/update-${version}.tar.gz"
  log "Downloading update $version → $out"
  curl -fsS -o "$out" "$url/api/v1/updates/download/${version}"
  log "Downloaded $(du -h "$out" | awk '{print $1}'). Run: $0 --apply $out"
}

apply() {
  local bundle="${1:?bundle file required}"
  [[ -f "$bundle" ]] || fail "Bundle not found: $bundle"
  local work; work=$(mktemp -d)
  trap "rm -rf $work" EXIT

  log "Extracting bundle"
  tar -xzf "$bundle" -C "$work"
  [[ -f "$work/manifest.json" ]] || fail "Bundle missing manifest.json"

  local new_ver from_versions expected_sha actual_sha
  new_ver=$(jq -r .version "$work/manifest.json")
  from_versions=$(jq -r '.fromVersion | join(",")' "$work/manifest.json")
  expected_sha=$(jq -r .sha256 "$work/manifest.json")

  log "Bundle declares version=$new_ver, applicable from=[$from_versions]"

  # Compatibility check
  if [[ ",$from_versions," != *",$(current_version),"* ]] && [[ "$from_versions" != "*" ]]; then
    fail "Update $new_ver does not list $(current_version) in fromVersion. Aborting."
  fi

  # SHA-256 verify
  log "Verifying image.tar checksum"
  actual_sha=$(sha256sum "$work/image.tar" | awk '{print $1}')
  [[ "$actual_sha" == "$expected_sha" ]] || fail "Checksum mismatch: $actual_sha vs $expected_sha"

  # Snapshot current state for rollback
  log "Snapshotting current state for rollback"
  local snap="$STATE_DIR/rollback-$(date +%s)"
  mkdir -p "$snap"
  cp "$INSTALL_DIR/.env" "$snap/env"
  echo "$(current_version)" > "$snap/version"
  $COMPOSE exec -T postgres pg_dump -U "${PGUSER:-glide_hims}" "${PGDATABASE:-glide_hims}" \
    | gzip > "$snap/pre-update.sql.gz" 2>/dev/null || log "WARN: snapshot pg_dump failed (non-fatal)"
  ln -sfn "$snap" "$STATE_DIR/last-rollback"

  # Load new image
  log "Loading new Docker image (this can take a minute)"
  docker load -i "$work/image.tar"

  # Bump version in .env
  sed -i "s|^HIMS_VERSION=.*|HIMS_VERSION=$new_ver|" "$INSTALL_DIR/.env"

  # Apply SQL migrations (if any) — lex order
  if [[ -d "$work/migrations" ]]; then
    log "Applying SQL migrations"
    for m in "$work"/migrations/*.sql; do
      [[ -f "$m" ]] || continue
      log "  → $(basename "$m")"
      $COMPOSE exec -T postgres psql -U "${PGUSER:-glide_hims}" -d "${PGDATABASE:-glide_hims}" \
        -v ON_ERROR_STOP=1 < "$m"
    done
  fi

  # Recreate backend with new image
  log "Restarting backend container"
  $COMPOSE up -d backend

  # Health check
  log "Waiting for backend to become healthy"
  for i in {1..24}; do
    if $COMPOSE ps backend 2>/dev/null | grep -q healthy; then
      log "✅ Update to $new_ver complete"
      [[ -x "$work/post-install.sh" ]] && bash "$work/post-install.sh" || true
      return 0
    fi
    sleep 5
  done

  log "⚠ Backend not healthy after update — auto-rolling back"
  rollback
  fail "Update failed; rolled back to previous version"
}

rollback() {
  local snap="$STATE_DIR/last-rollback"
  [[ -L "$snap" ]] || fail "No rollback snapshot available"
  local prev_ver; prev_ver=$(cat "$snap/version")
  log "Rolling back to $prev_ver"
  cp "$snap/env" "$INSTALL_DIR/.env"
  if [[ -f "$snap/pre-update.sql.gz" ]]; then
    log "Restoring database snapshot"
    gunzip -c "$snap/pre-update.sql.gz" \
      | $COMPOSE exec -T postgres psql -U "${PGUSER:-glide_hims}" -d "${PGDATABASE:-glide_hims}"
  fi
  $COMPOSE up -d backend
  log "✅ Rollback complete"
}

case "${1:-}" in
  --check)    check_for_update ;;
  --download) shift; download "$@" ;;
  --apply)    shift; apply "$@" ;;
  --rollback) rollback ;;
  *) sed -n '2,15p' "$0"; exit 1 ;;
esac
