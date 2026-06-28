#!/bin/bash

###############################################################################
#                                                                             #
#     Glide-HIMS Standalone Offline Installer                               #
#     For air-gapped deployments (government, military, remote clinics)      #
#                                                                             #
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GLIDE_DIR="/opt/glide-hims"
DATA_DIR="/data/glide-hims"
BACKUPS_DIR="/data/glide-hims-backups"
UPDATES_DIR="/data/glide-hims-updates"
DOCKER_IMAGE_NAME="glide-hims:standalone"
CONTAINER_NAME="glide-hims"

###############################################################################
# Helper Functions
###############################################################################

log_info() {
  echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
  echo -e "${GREEN}✓${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
  echo -e "${RED}✗${NC} $*"
}

check_prerequisites() {
  log_info "Checking prerequisites..."

  # Check Docker
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
  fi
  log_success "Docker found: $(docker --version)"

  # Check Docker Daemon
  if ! docker info &> /dev/null; then
    log_error "Docker daemon is not running. Please start Docker."
    exit 1
  fi
  log_success "Docker daemon is running"

  # Check disk space
  AVAILABLE_SPACE=$(df /opt 2>/dev/null | awk 'NR==2 {print $4}')
  if [ -z "$AVAILABLE_SPACE" ]; then
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
  fi

  REQUIRED_SPACE=$((5 * 1024 * 1024)) # 5GB in KB

  if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
    log_error "Insufficient disk space. Required: 5GB, Available: $(( AVAILABLE_SPACE / 1024 / 1024 ))GB"
    exit 1
  fi
  log_success "Sufficient disk space available"
}

configure_installation() {
  log_info "Configuring installation..."

  # Prompt for license key (skip if already set by bootstrap)
  if [ -n "${LICENSE_KEY:-}" ]; then
    log_success "License key pre-configured"
  else
    while true; do
      read -p "Enter your license key: " LICENSE_KEY
      if [[ $LICENSE_KEY =~ ^GLIDE-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$ ]] || \
         [[ $LICENSE_KEY =~ ^GLI-STD-[0-9]{8}-[A-Z0-9]{5}-[A-Z0-9]{8}$ ]]; then
        log_success "License key validated: $LICENSE_KEY"
        break
      else
        log_error "Invalid license key format. Expected: GLIDE-XXXX-XXXX-XXXX-XXXX"
      fi
    done
  fi

  # Prompt for admin password
  while true; do
    read -sp "Enter admin password: " ADMIN_PASSWORD
    echo
    read -sp "Confirm admin password: " ADMIN_PASSWORD_CONFIRM
    echo

    if [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD_CONFIRM" ]; then
      log_success "Admin password set"
      break
    else
      log_error "Passwords do not match. Try again."
    fi
  done

  # Prompt for hospital name
  read -p "Enter hospital/organization name: " HOSPITAL_NAME
  log_success "Hospital name set: $HOSPITAL_NAME"

  # Prompt for backup location
  read -p "Enter backup location (default: $BACKUPS_DIR): " BACKUP_LOCATION
  BACKUP_LOCATION=${BACKUP_LOCATION:-$BACKUPS_DIR}
  log_success "Backup location set: $BACKUP_LOCATION"

  # Generate JWT secret if not provided
  JWT_SECRET=$(openssl rand -base64 32)
  log_success "JWT secret generated"
}

setup_directories() {
  log_info "Creating directories..."

  mkdir -p "$DATA_DIR" "$BACKUPS_DIR" "$UPDATES_DIR"
  chmod 755 "$DATA_DIR" "$BACKUPS_DIR" "$UPDATES_DIR"

  log_success "Directories created and configured"
}

load_docker_image() {
  log_info "Loading Docker image from local archive..."

  # Check if image tar file exists
  if [ -f "glide-hims-standalone.tar.gz" ]; then
    log_info "Found glide-hims-standalone.tar.gz, loading image..."
    docker load < glide-hims-standalone.tar.gz
    log_success "Docker image loaded successfully"
  else
    log_warn "Docker image file not found. Building from source..."
    log_info "Building Docker image (this may take 5-10 minutes)..."
    docker build -f packages/backend/Dockerfile.standalone -t "$DOCKER_IMAGE_NAME" .
    log_success "Docker image built successfully"
  fi
}

create_env_file() {
  log_info "Creating .env configuration..."

  cat > "$GLIDE_DIR/.env" << ENVFILE
# Glide-HIMS Standalone Configuration
NODE_ENV=production
DB_TYPE=sqlite
SQLITE_PATH=$DATA_DIR/glide-hims.db
JWT_SECRET=$JWT_SECRET
JWT_EXPIRATION=24h
REFRESH_TOKEN_EXPIRATION=7d
PORT=3000
LOG_LEVEL=info
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=$(openssl rand -base64 16)

# Organization
HOSPITAL_NAME=$HOSPITAL_NAME
LICENSE_KEY=$LICENSE_KEY

# Backup
BACKUP_LOCATION=$BACKUP_LOCATION
BACKUP_SCHEDULE="0 2 * * *" # Daily at 2 AM

# Updates
UPDATES_PATH=$UPDATES_DIR
CHECK_UPDATES_INTERVAL=604800 # Weekly (in seconds)

# Security
ENABLE_2FA=false
SESSION_TIMEOUT=3600
ENVFILE

  log_success ".env file created at $GLIDE_DIR/.env"

  # Attempt to download offline license file if the platform is reachable
  # (standalone may be air-gapped — this step is best-effort)
  PLATFORM_URL="${CONTROL_PLANE_URL:-https://hmisdemo.itsolutionsuganda.com}"
  if [ -n "$LICENSE_KEY" ]; then
    log_info "Attempting to download offline license file..."
    mkdir -p /etc/glide-hims
    if curl -sf --connect-timeout 10 "${PLATFORM_URL}/api/v1/license/${LICENSE_KEY}/export" -o /etc/glide-hims/license.json 2>/dev/null; then
      SECRET_KEY=$(python3 -c "import json; print(json.load(open('/etc/glide-hims/license.json'))['secretKey'])" 2>/dev/null || true)
      log_success "Offline license file saved to /etc/glide-hims/license.json"
    else
      log_info "Platform unreachable — offline license file will need to be placed manually at /etc/glide-hims/license.json"
    fi
  fi

  # Ensure LICENSE_SECRET_KEY is set (required for production startup)
  if [ -z "$SECRET_KEY" ]; then
    SECRET_KEY=$(openssl rand -hex 32)
    log_info "LICENSE_SECRET_KEY not found in license export — generated a local key"
  fi
  echo "" >> "$GLIDE_DIR/.env"
  echo "# License secret for offline HMAC validation" >> "$GLIDE_DIR/.env"
  echo "LICENSE_SECRET_KEY=$SECRET_KEY" >> "$GLIDE_DIR/.env"
}

start_containers() {
  log_info "Starting Docker containers..."

  cd "$GLIDE_DIR" || exit 1

  docker-compose -f docker-compose.standalone.yml up -d

  # Wait for services to be ready
  log_info "Waiting for services to start (this may take 1-2 minutes)..."
  sleep 30

  log_success "Docker containers started"
}

verify_installation() {
  log_info "Verifying installation..."

  # Check backend health
  log_info "Checking backend health..."
  if curl -sf http://localhost:3000/api/v1/health > /dev/null 2>&1; then
    log_success "Backend is healthy"
  else
    log_error "Backend health check failed. Check logs with: docker-compose -f $GLIDE_DIR/docker-compose.standalone.yml logs backend"
    return 1
  fi

  # Check database
  log_info "Checking database..."
  if [ -f "$DATA_DIR/glide-hims.db" ]; then
    DB_SIZE=$(du -h "$DATA_DIR/glide-hims.db" | cut -f1)
    log_success "Database created successfully (Size: $DB_SIZE)"
  else
    log_error "Database not found at $DATA_DIR/glide-hims.db"
    return 1
  fi

  log_success "Installation verified successfully!"
}

display_next_steps() {
  cat << 'STEPS'

╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║        ✓ GLIDE-HIMS STANDALONE INSTALLATION COMPLETE ✓            ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝

NEXT STEPS:

1. ACCESS THE SYSTEM
   Open your browser and go to: http://localhost:3000
   
   Or if on a network, use: http://<server-ip>:3000

2. FIRST-TIME SETUP
   • Click "Setup" or "First Run"
   • Create admin account with the password you provided
   • Configure hospital settings
   • System will be ready to use!

3. DAILY OPERATIONS
   Check status:    docker-compose -f /opt/glide-hims/docker-compose.standalone.yml ps
   View logs:       docker-compose -f /opt/glide-hims/docker-compose.standalone.yml logs -f
   Stop system:     docker-compose -f /opt/glide-hims/docker-compose.standalone.yml stop
   Start system:    docker-compose -f /opt/glide-hims/docker-compose.standalone.yml start

4. BACKUP & RECOVERY
   Manual backup:   docker exec glide-hims-backend /app/scripts/backup.sh
   List backups:    ls -la /data/glide-hims-backups/
   Restore backup:  docker exec glide-hims-backend /app/scripts/restore.sh <backup-file>

5. OFFLINE UPDATES
   Check for updates:  docker exec glide-hims-backend npm run check-updates
   Apply update:       docker exec glide-hims-backend npm run apply-update <update-file>

6. TROUBLESHOOTING
   Database issues?    docker-compose down && docker volume prune
   Need help?          Check logs: docker-compose logs backend
   Reset data?         rm /data/glide-hims/glide-hims.db && docker-compose restart

IMPORTANT INFORMATION:

✓ License Key: $LICENSE_KEY
✓ Hospital: $HOSPITAL_NAME
✓ Data Location: $DATA_DIR
✓ Backups Location: $BACKUPS_DIR
✓ Updates Location: $UPDATES_DIR

SECURITY NOTES:

• Your database is stored at: $DATA_DIR/glide-hims.db
• Regular backups are automatically created daily at 2 AM
• Keep backups on external storage (USB drive, external disk)
• Never share your license key publicly

SUPPORT:

For issues or questions, contact:
Email: support@itsolutionsuganda.com
Documentation: https://docs.glide-hims.local

═════════════════════════════════════════════════════════════════════

STEPS
}

###############################################################################
# Main Installation Flow
###############################################################################

main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════════╗"
  echo "║                                                                    ║"
  echo "║      🚀 GLIDE-HIMS STANDALONE OFFLINE INSTALLATION 🚀             ║"
  echo "║                                                                    ║"
  echo "║      For government, military, and offline clinics                ║"
  echo "║                                                                    ║"
  echo "╚════════════════════════════════════════════════════════════════════╝"
  echo ""

  check_prerequisites
  configure_installation
  setup_directories
  load_docker_image
  create_env_file
  start_containers
  verify_installation
  display_next_steps
}

# Run main function
main "$@"
