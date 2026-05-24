#!/bin/bash

###############################################################################
# Glide-HIMS Hybrid Deployment Installer
#
# This script automates the deployment of Glide-HIMS on customer infrastructure.
# Supports Linux and macOS (Docker required)
#
# Usage: bash install-hybrid.sh
#
# Expected env vars (set by the bootstrap script):
#   CONTROL_PLANE_URL  - URL of the Glide-HIMS control plane (for tarball download)
#   DOMAIN_NAME        - Customer domain name
#   DB_PASSWORD        - Database password
#   JWT_SECRET         - JWT signing secret
#   REDIS_PASSWORD     - Redis password
#   LICENSE_KEY        - License key
#   INSTALL_DIR        - Installation directory (default: /opt/glide-hims)
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VERSION="1.0.0"
INSTALL_DIR="${INSTALL_DIR:-/opt/glide-hims}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
LICENSE_KEY="${LICENSE_KEY:-}"
CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-}"
GIT_REPO_URL="${GIT_REPO_URL:-https://github.com/Elvis256/glide-Hims.git}"

# Functions
print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Helper: download a file via curl or wget
fetch_file() {
    local url="$1"
    local dest="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url" -o "$dest"
    elif command -v wget >/dev/null 2>&1; then
        wget -q "$url" -O "$dest"
    else
        print_error "Neither curl nor wget found"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        print_info "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker is installed: $(docker --version)"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed."
        print_info "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose is installed: $(docker-compose --version)"
    else
        print_success "Docker Compose plugin detected: $(docker compose version)"
    fi

    # Check disk space
    AVAILABLE_SPACE=$(df -k "$INSTALL_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || df -k / | awk 'NR==2 {print $4}')
    if [ "$AVAILABLE_SPACE" -lt 10485760 ]; then  # 10GB in KB
        print_warning "Less than 10GB disk space available. Recommended: 20GB+"
    else
        print_success "Disk space: $(numfmt --to=iec $((AVAILABLE_SPACE * 1024)) 2>/dev/null || echo "${AVAILABLE_SPACE}K") available"
    fi
}

# Download the source code into INSTALL_DIR
download_source() {
    print_header "Downloading Source Code"

    mkdir -p "$INSTALL_DIR"

    local downloaded=false

    # Strategy 1: Download tarball from control plane Downloads API
    if [ -n "$CONTROL_PLANE_URL" ]; then
        print_info "Attempting to download source tarball from control plane..."
        local tarball_path
        tarball_path="$(mktemp /tmp/glide-hims-src-XXXXXX.tar.gz)"

        # Try the downloads API (list installers, find tarball)
        if fetch_file "${CONTROL_PLANE_URL}/api/v1/downloads" /tmp/glide-downloads-list.json 2>/dev/null; then
            local tarball_id
            tarball_id=$(grep -o '"id":"[^"]*"' /tmp/glide-downloads-list.json | head -1 | cut -d'"' -f4 || true)
            if [ -n "$tarball_id" ] && fetch_file "${CONTROL_PLANE_URL}/api/v1/downloads/${tarball_id}/file" "$tarball_path" 2>/dev/null; then
                print_success "Downloaded tarball from control plane"
                tar xzf "$tarball_path" -C "$INSTALL_DIR" --strip-components=1 2>/dev/null || \
                    tar xzf "$tarball_path" -C "$INSTALL_DIR" 2>/dev/null
                downloaded=true
            fi
            rm -f /tmp/glide-downloads-list.json
        fi
        rm -f "$tarball_path"
    fi

    # Strategy 2: Clone from git
    if [ "$downloaded" = false ]; then
        if command -v git &> /dev/null; then
            print_info "Cloning repository from $GIT_REPO_URL ..."
            git clone --depth 1 "$GIT_REPO_URL" "$INSTALL_DIR/src-tmp" 2>&1 | tail -5
            # Move contents into INSTALL_DIR (in case it's not empty)
            cp -a "$INSTALL_DIR/src-tmp/." "$INSTALL_DIR/" 2>/dev/null || true
            rm -rf "$INSTALL_DIR/src-tmp"
            downloaded=true
            print_success "Repository cloned"
        else
            print_error "Cannot obtain source code: no tarball available and git is not installed"
            exit 1
        fi
    fi

    # Copy files needed by docker-compose volume mounts into the expected locations
    if [ -f "$INSTALL_DIR/deployment/standalone/init-db.sql" ] && [ ! -f "$INSTALL_DIR/init-db.sql" ]; then
        cp "$INSTALL_DIR/deployment/standalone/init-db.sql" "$INSTALL_DIR/init-db.sql"
        print_success "Copied init-db.sql into place"
    fi

    if [ -f "$INSTALL_DIR/nginx.hybrid.conf" ] && [ ! -f "$INSTALL_DIR/nginx.conf" ]; then
        cp "$INSTALL_DIR/nginx.hybrid.conf" "$INSTALL_DIR/nginx.conf"
        print_success "Copied nginx.hybrid.conf → nginx.conf"
    fi

    print_success "Source code ready at $INSTALL_DIR"
}

# Configure installation
configure_installation() {
    print_header "Configuration"

    # Get domain name
    if [ -z "$DOMAIN_NAME" ]; then
        print_info "Enter your domain name (e.g., hospital.example.com):"
        read -r DOMAIN_NAME
        if [ -z "$DOMAIN_NAME" ]; then
            print_error "Domain name is required"
            exit 1
        fi
    fi
    print_success "Domain: $DOMAIN_NAME"

    # Generate passwords if not set
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(openssl rand -base64 32)
        print_success "Generated database password"
    fi

    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 32)
        print_success "Generated JWT secret"
    fi

    if [ -z "$REDIS_PASSWORD" ]; then
        REDIS_PASSWORD=$(openssl rand -base64 32)
        print_success "Generated Redis password"
    fi

    # Get license key
    if [ -z "$LICENSE_KEY" ]; then
        print_info "Enter your Glide-HIMS license key:"
        read -r LICENSE_KEY
        if [ -z "$LICENSE_KEY" ]; then
            print_error "License key is required"
            exit 1
        fi
    fi
    print_success "License key configured"

    # Generate encryption keys for production
    MFA_ENCRYPTION_KEY=$(openssl rand -hex 32)
    PII_ENCRYPTION_KEY=$(openssl rand -hex 32)
    PII_HASH_KEY=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 48 | tr -d '\n')

    # Create .env file
    print_info "Creating environment configuration..."
    cat > "$INSTALL_DIR/.env" << EOF
# Glide-HIMS Hybrid Deployment Configuration
# Generated on $(date)

# Domain Configuration
DOMAIN_NAME=$DOMAIN_NAME

# Database Configuration
DB_HOST=postgres
DB_USERNAME=hims_admin
DB_PASSWORD=$DB_PASSWORD
DB_NAME=glide_hims
DB_USER=hims_admin

# Redis Configuration
REDIS_PASSWORD=$REDIS_PASSWORD

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
REFRESH_TOKEN_SECRET=$JWT_REFRESH_SECRET
REFRESH_TOKEN_EXPIRES_IN=7d

# Encryption Keys (required in production)
MFA_ENCRYPTION_KEY=$MFA_ENCRYPTION_KEY
PII_ENCRYPTION_KEY=$PII_ENCRYPTION_KEY
PII_HASH_KEY=$PII_HASH_KEY

# Environment
NODE_ENV=production

# License
LICENSE_KEY=$LICENSE_KEY

# Backup Configuration (optional)
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM UTC
BACKUP_RETENTION_DAYS=30

# Monitoring (optional)
MONITORING_ENABLED=true
METRICS_PORT=9090

# Support
SUPPORT_EMAIL=support@itsolutionsuganda.com
SUPPORT_PHONE=+256-XXX-XXX-XXX
EOF
    print_success ".env file created"
}

# Create necessary directories
setup_directories() {
    print_header "Setting Up Directories"

    mkdir -p "$INSTALL_DIR"/{ssl,logs,data,backups}
    print_success "Created directories"

    # Create SSL self-signed certificate if not exists
    if [ ! -f "$INSTALL_DIR/ssl/cert.pem" ]; then
        print_info "Generating self-signed SSL certificate..."
        openssl req -x509 -newkey rsa:2048 -nodes \
            -out "$INSTALL_DIR/ssl/cert.pem" \
            -keyout "$INSTALL_DIR/ssl/key.pem" \
            -days 365 \
            -subj "/C=UG/ST=Uganda/L=Kampala/O=Hospital/CN=$DOMAIN_NAME"
        print_success "Self-signed certificate created (valid for 365 days)"
        print_warning "Replace with production certificate before going live"
    else
        print_success "SSL certificate found"
    fi
}

# Download Docker images and build
download_images() {
    print_header "Downloading Docker Images"

    cd "$INSTALL_DIR"

    print_info "Pulling latest images (this may take a few minutes)..."

    docker pull postgres:15-alpine
    print_success "PostgreSQL image ready"

    docker pull redis:7-alpine
    print_success "Redis image ready"

    docker pull nginx:alpine
    print_success "Nginx image ready"

    print_info "Building backend image..."
    docker-compose -f docker-compose.hybrid.yml build backend 2>&1 | tail -20
    print_success "Backend image built"

    print_info "Building frontend image..."
    docker-compose -f docker-compose.hybrid.yml build frontend 2>&1 | tail -20
    print_success "Frontend image built"
}

# Start services
start_services() {
    print_header "Starting Services"

    cd "$INSTALL_DIR"

    print_info "Bringing up containers (this may take 30-60 seconds)..."
    docker-compose -f docker-compose.hybrid.yml up -d

    sleep 10

    # Wait for health checks
    print_info "Waiting for services to be healthy..."
    for i in $(seq 1 60); do
        if docker-compose -f docker-compose.hybrid.yml ps | grep -q "healthy"; then
            print_success "Services are healthy"
            break
        fi
        echo -n "."
        sleep 1
    done

    # Check final status
    print_info "Service status:"
    docker-compose -f docker-compose.hybrid.yml ps
}

# Verify installation
verify_installation() {
    print_header "Verifying Installation"

    # Check API
    print_info "Checking API endpoint..."
    if curl -s http://localhost:3000/api/v1/health | grep -q "ok"; then
        print_success "Backend API is responding"
    else
        print_warning "Backend API check inconclusive (may need more time)"
    fi

    # Check Frontend
    print_info "Checking frontend..."
    if curl -s http://localhost:8080 | grep -q "Glide"; then
        print_success "Frontend is accessible"
    else
        print_warning "Frontend check inconclusive"
    fi

    # Check Database
    print_info "Checking database..."
    if docker-compose -f docker-compose.hybrid.yml exec -T postgres pg_isready -U hims_admin > /dev/null 2>&1; then
        print_success "Database is running"
    else
        print_warning "Database check inconclusive"
    fi
}

# Show completion message
show_completion() {
    print_header "Installation Complete"

    echo -e "${GREEN}Glide-HIMS is now running!${NC}\n"

    echo -e "${BLUE}Access URLs:${NC}"
    echo -e "  Frontend:  https://$DOMAIN_NAME"
    echo -e "  Admin API: https://$DOMAIN_NAME/api/v1"
    echo -e "  Health:    https://$DOMAIN_NAME/api/v1/health\n"

    echo -e "${BLUE}Database Credentials:${NC}"
    echo -e "  Host:     postgres (localhost:5432)"
    echo -e "  Database: glide_hims"
    echo -e "  User:     hims_admin\n"

    echo -e "${BLUE}Management Commands:${NC}"
    echo -e "  View logs:       docker-compose -f docker-compose.hybrid.yml logs -f"
    echo -e "  Stop services:   docker-compose -f docker-compose.hybrid.yml stop"
    echo -e "  Start services:  docker-compose -f docker-compose.hybrid.yml start"
    echo -e "  Restart:         docker-compose -f docker-compose.hybrid.yml restart"
    echo -e "  Full restart:    docker-compose -f docker-compose.hybrid.yml down && docker-compose -f docker-compose.hybrid.yml up -d\n"

    echo -e "${YELLOW}Important:${NC}"
    echo -e "  1. Update SSL certificates before going to production"
    echo -e "  2. Backup your .env file with sensitive credentials"
    echo -e "  3. Set up automated backups (see documentation)"
    echo -e "  4. Contact support@itsolutionsuganda.com for configuration help\n"

    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "  1. Open https://$DOMAIN_NAME in your browser"
    echo -e "  2. Complete the initial setup wizard"
    echo -e "  3. Configure SSL with production certificate"
    echo -e "  4. Set up backup strategy"
}

# Main execution
main() {
    print_header "Glide-HIMS Hybrid Deployment Installer v$VERSION"

    check_prerequisites
    download_source
    configure_installation
    setup_directories
    download_images
    start_services
    verify_installation
    show_completion
}

# Run main function
main "$@"
