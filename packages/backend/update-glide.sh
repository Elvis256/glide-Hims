#!/usr/bin/env bash
# ============================================================================
# Glide-HIMS On-Premise Update Script
# Called by UpdateClientService or manually by a system admin.
#
# Environment variables (set by the caller):
#   UPDATE_URL    – URL to download the new source bundle (license-gated)
#   LICENSE_KEY   – License key (appended to URL if needed)
#   ROLLOUT_ID    – Optional rollout ID for reporting
#   PLATFORM_URL  – Platform base URL for reporting
# ============================================================================

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/glide-hims}"
STAGING_DIR="$INSTALL_DIR/staging"
BACKUP_DIR="$INSTALL_DIR/current.bak.$(date +%s)"
CURRENT_DIR="$INSTALL_DIR/current"
LOG_FILE="$INSTALL_DIR/update-$(date +%Y%m%d-%H%M%S).log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
die() { log "FATAL: $*"; exit 1; }

report_status() {
  local status="$1"
  local error_msg="${2:-}"
  if [ -n "${ROLLOUT_ID:-}" ] && [ -n "${PLATFORM_URL:-}" ]; then
    local report_url="${PLATFORM_URL}/v1/deployments/rollouts/${ROLLOUT_ID}/report"
    curl -sf -X POST "$report_url" \
      -H 'Content-Type: application/json' \
      -d "{\"licenseKey\":\"${LICENSE_KEY:-}\",\"status\":\"${status}\",\"errorMessage\":\"${error_msg}\"}" \
      --connect-timeout 10 --max-time 30 2>/dev/null || true
  fi
}

rollback() {
  log "Rolling back to previous version..."
  if [ -d "$BACKUP_DIR" ]; then
    rm -rf "$CURRENT_DIR"
    mv "$BACKUP_DIR" "$CURRENT_DIR"
    log "Restored from backup"
  fi

  log "Restarting services after rollback..."
  restart_services
  report_status "rolled_back" "Update failed — rolled back to previous version"
}

restart_services() {
  cd "$INSTALL_DIR"
  if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -q glide; then
    pm2 restart glide-backend 2>/dev/null || true
  elif [ -f "$INSTALL_DIR/docker-compose.yml" ] || [ -f "$INSTALL_DIR/docker-compose.standalone.yml" ]; then
    local compose_file
    compose_file=$(ls "$INSTALL_DIR"/docker-compose*.yml 2>/dev/null | head -1)
    if [ -n "$compose_file" ]; then
      docker-compose -f "$compose_file" restart 2>/dev/null || docker compose -f "$compose_file" restart 2>/dev/null || true
    fi
  elif command -v systemctl &>/dev/null && systemctl is-active --quiet glide-hims 2>/dev/null; then
    systemctl restart glide-hims
  fi
}

stop_services() {
  cd "$INSTALL_DIR"
  if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -q glide; then
    pm2 stop glide-backend 2>/dev/null || true
  elif [ -f "$INSTALL_DIR/docker-compose.yml" ] || [ -f "$INSTALL_DIR/docker-compose.standalone.yml" ]; then
    local compose_file
    compose_file=$(ls "$INSTALL_DIR"/docker-compose*.yml 2>/dev/null | head -1)
    if [ -n "$compose_file" ]; then
      docker-compose -f "$compose_file" stop 2>/dev/null || docker compose -f "$compose_file" stop 2>/dev/null || true
    fi
  elif command -v systemctl &>/dev/null && systemctl is-active --quiet glide-hims 2>/dev/null; then
    systemctl stop glide-hims
  fi
}

health_check() {
  local port="${APP_PORT:-3000}"
  local retries=10
  local i=0
  while [ $i -lt $retries ]; do
    if curl -sf "http://localhost:${port}/health" --connect-timeout 5 >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
    i=$((i + 1))
  done
  return 1
}

# =========================== Main ===========================

log "=== Glide-HIMS Update Started ==="
report_status "started"

# 1. Validate inputs
[ -n "${UPDATE_URL:-}" ] || die "UPDATE_URL is not set"
log "Update URL: $UPDATE_URL"

# 2. Download new source bundle
log "Downloading source bundle..."
mkdir -p "$STAGING_DIR"
TARBALL="$STAGING_DIR/source-bundle.tar.gz"
if ! curl -fSL "$UPDATE_URL" -o "$TARBALL" --connect-timeout 30 --max-time 600; then
  die "Failed to download source bundle"
fi
log "Download complete: $(du -h "$TARBALL" | cut -f1)"

report_status "in_progress"

# 3. Extract to staging
log "Extracting to staging..."
rm -rf "$STAGING_DIR/source"
mkdir -p "$STAGING_DIR/source"
tar -xzf "$TARBALL" -C "$STAGING_DIR/source" --strip-components=0
rm -f "$TARBALL"

# 4. Stop services
log "Stopping services..."
stop_services

# 5. Backup current
log "Backing up current installation to $BACKUP_DIR..."
if [ -d "$CURRENT_DIR" ]; then
  cp -a "$CURRENT_DIR" "$BACKUP_DIR"
fi

# 6. Replace current with staging (preserve .env and data)
log "Replacing source files..."
# Preserve config and data files
for f in .env uploads backups data ssl; do
  if [ -e "$CURRENT_DIR/$f" ]; then
    cp -a "$CURRENT_DIR/$f" "$STAGING_DIR/source/$f" 2>/dev/null || true
  fi
done
# Also preserve packages/backend/.env if it exists
if [ -f "$CURRENT_DIR/packages/backend/.env" ]; then
  mkdir -p "$STAGING_DIR/source/packages/backend"
  cp -a "$CURRENT_DIR/packages/backend/.env" "$STAGING_DIR/source/packages/backend/.env"
fi

rm -rf "$CURRENT_DIR"
mv "$STAGING_DIR/source" "$CURRENT_DIR"

# 7. Install dependencies
log "Installing dependencies..."
cd "$CURRENT_DIR"
if [ -f "pnpm-workspace.yaml" ] && command -v pnpm &>/dev/null; then
  pnpm install --frozen-lockfile 2>&1 | tail -5 | tee -a "$LOG_FILE"
elif [ -f "package-lock.json" ]; then
  npm ci 2>&1 | tail -5 | tee -a "$LOG_FILE"
else
  npm install 2>&1 | tail -5 | tee -a "$LOG_FILE"
fi

# 8. Build
log "Building application..."
if [ -f "packages/backend/package.json" ]; then
  cd packages/backend && npm run build 2>&1 | tail -5 | tee -a "$LOG_FILE" && cd ../..
fi

# 9. Run migrations
log "Running database migrations..."
if [ -f "packages/backend/package.json" ]; then
  cd packages/backend
  npx typeorm migration:run -d dist/database/data-source.js 2>&1 | tail -5 | tee -a "$LOG_FILE" || log "WARNING: Migration failed (may be non-critical)"
  cd ../..
fi

# 10. Restart services
log "Restarting services..."
restart_services

# 11. Health check
log "Running health check..."
if health_check; then
  log "Health check passed"
  report_status "success"

  # Clean up backup and staging
  rm -rf "$BACKUP_DIR" "$STAGING_DIR"
  log "=== Update completed successfully ==="
  exit 0
else
  log "ERROR: Health check failed after update"
  rollback
  exit 1
fi
