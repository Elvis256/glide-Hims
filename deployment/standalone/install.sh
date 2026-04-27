#!/usr/bin/env bash
# Glide-HIMS standalone installer
# Bare-metal Linux: installs Docker (if missing), generates secrets, loads pre-built
# image (if present), launches the stack, prints credentials.
#
# Usage:
#   sudo ./install.sh                       # interactive
#   sudo ./install.sh --image image.tar     # air-gapped (load image from tarball)
#   sudo ./install.sh --non-interactive     # uses defaults, fails if .env missing required vars

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/glide-hims}"
IMAGE_TARBALL=""
INTERACTIVE=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)            IMAGE_TARBALL="$2"; shift 2 ;;
    --non-interactive)  INTERACTIVE=0; shift ;;
    --install-dir)      INSTALL_DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

log()  { printf '\033[1;34m[%s]\033[0m %s\n' "$(date +%T)" "$*"; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Run as root (sudo)"

log "Checking prerequisites…"
if ! command -v docker >/dev/null 2>&1; then
  log "Docker not found — installing via convenience script"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 || fail "docker compose plugin required"

log "Preparing install directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
cp "$SCRIPT_DIR"/{Dockerfile,docker-compose.yml,nginx.conf,init-db.sql,env.example} "$INSTALL_DIR/" 2>/dev/null || true
mkdir -p "$INSTALL_DIR/certs" "$INSTALL_DIR/scripts"
cp "$SCRIPT_DIR"/../scripts/*.sh "$INSTALL_DIR/scripts/" 2>/dev/null || true

cd "$INSTALL_DIR"

if [[ -n "$IMAGE_TARBALL" ]]; then
  [[ -f "$IMAGE_TARBALL" ]] || fail "Image tarball not found: $IMAGE_TARBALL"
  log "Loading image from $IMAGE_TARBALL (this can take a minute)…"
  docker load -i "$IMAGE_TARBALL"
fi

if [[ ! -f .env ]]; then
  log "Generating .env with random secrets"
  cp env.example .env
  DB_PASS=$(openssl rand -base64 24 | tr -d '/+=')
  JWT=$(openssl rand -hex 64)
  JWT_R=$(openssl rand -hex 64)
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" .env
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
  sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_R}|" .env
  if [[ $INTERACTIVE -eq 1 ]]; then
    read -rp "Hospital name (free text, used in branding): " HOSPITAL_NAME || true
    read -rp "License key (leave blank for trial): " LIC || true
    [[ -n "${LIC:-}" ]] && sed -i "s|^LICENSE_KEY=.*|LICENSE_KEY=${LIC}|" .env
    [[ -n "${HOSPITAL_NAME:-}" ]] && echo "HOSPITAL_NAME=${HOSPITAL_NAME}" >> .env
  fi
  chmod 600 .env
fi

if [[ ! -f certs/fullchain.pem ]]; then
  log "No TLS cert found; generating self-signed (replace later with real cert)"
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout certs/privkey.pem -out certs/fullchain.pem \
    -subj "/CN=hims.local" 2>/dev/null
  chmod 600 certs/privkey.pem
fi

log "Starting stack with docker compose"
docker compose pull --ignore-pull-failures 2>/dev/null || true
docker compose up -d

log "Waiting for backend to become healthy (timeout 120 s)…"
for i in {1..24}; do
  if docker compose ps backend | grep -q healthy; then
    log "Backend is healthy"; break
  fi
  sleep 5
done

if ! docker compose ps backend | grep -q healthy; then
  log "Backend not yet healthy — showing recent logs:"
  docker compose logs --tail 80 backend
  fail "Backend failed to become healthy"
fi

log "✅ Installation complete"
echo
echo "  Frontend:  http://$(hostname -I | awk '{print $1}')"
echo "  API:       http://$(hostname -I | awk '{print $1}')/api/v1"
echo "  Logs:      cd $INSTALL_DIR && docker compose logs -f"
echo "  Backups:   $INSTALL_DIR/scripts/backup-manager.sh runs nightly at 02:00"
echo
echo "  Next: open the URL above and complete the first-run setup wizard"
