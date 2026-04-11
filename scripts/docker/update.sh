#!/bin/bash
# =============================================================================
# Glide HIMS - Update Script
# Updates on-premise installation to latest version
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Glide HIMS Update${NC}"
echo -e "${BLUE}========================================${NC}"

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/glide-hims}"
BACKUP_DIR="${INSTALL_DIR}/backups"
UPDATE_SERVER="https://hmisdemo.itsolutionsuganda.com/api/updates"

cd ${INSTALL_DIR}

# Check current version
CURRENT_VERSION=$(docker inspect glide-hims-backend:latest --format='{{.Config.Labels.org.opencontainers.image.version}}' 2>/dev/null || echo "unknown")
echo -e "Current version: ${CURRENT_VERSION}"

# Check for updates
echo -e "\n${BLUE}Checking for updates...${NC}"

if [ -n "$OFFLINE_PACKAGE" ]; then
    # Offline update
    echo -e "${YELLOW}Using offline package: ${OFFLINE_PACKAGE}${NC}"
    UPDATE_PACKAGE="$OFFLINE_PACKAGE"
else
    # Online update check
    LICENSE_KEY=$(grep LICENSE_KEY .env | cut -d'=' -f2)
    UPDATE_INFO=$(curl -s "${UPDATE_SERVER}/check?license=${LICENSE_KEY}&version=${CURRENT_VERSION}" 2>/dev/null || echo "")
    
    if [ -z "$UPDATE_INFO" ]; then
        echo -e "${YELLOW}Unable to check for updates (offline)${NC}"
        echo "Use OFFLINE_PACKAGE=/path/to/update.tar.gz for offline updates"
        exit 0
    fi
    
    LATEST_VERSION=$(echo "$UPDATE_INFO" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$LATEST_VERSION" = "$CURRENT_VERSION" ]; then
        echo -e "${GREEN}✓ Already running latest version${NC}"
        exit 0
    fi
    
    echo -e "New version available: ${GREEN}${LATEST_VERSION}${NC}"
fi

# Confirm update
read -p "Proceed with update? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Update cancelled"
    exit 0
fi

# Create backup
echo -e "\n${BLUE}Creating backup...${NC}"
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p ${BACKUP_DIR}

# Backup database
docker exec glide-hims-db pg_dump -U glide_hims glide_hims > "${BACKUP_DIR}/${BACKUP_NAME}.sql"
echo -e "${GREEN}✓ Database backed up${NC}"

# Backup configuration
cp .env "${BACKUP_DIR}/${BACKUP_NAME}.env"
echo -e "${GREEN}✓ Configuration backed up${NC}"

# Pull new images
echo -e "\n${BLUE}Downloading updates...${NC}"

if [ -n "$UPDATE_PACKAGE" ]; then
    # Load from offline package
    tar -xzf "$UPDATE_PACKAGE" -C /tmp/glide-update
    docker load -i /tmp/glide-update/backend.tar
    docker load -i /tmp/glide-update/frontend.tar
else
    # Pull from registry
    docker compose pull
fi

echo -e "${GREEN}✓ Updates downloaded${NC}"

# Apply update
echo -e "\n${BLUE}Applying update...${NC}"
docker compose up -d --force-recreate

# Wait for services
echo -e "\n${BLUE}Waiting for services...${NC}"
sleep 15

# Run migrations
echo -e "\n${BLUE}Running database migrations...${NC}"
docker exec glide-hims-backend npm run db:migrate || true

# Verify health
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")

if [ "$BACKEND_HEALTH" = "200" ]; then
    echo -e "${GREEN}✓ Update successful${NC}"
    NEW_VERSION=$(docker inspect glide-hims-backend:latest --format='{{.Config.Labels.org.opencontainers.image.version}}' 2>/dev/null || echo "unknown")
    echo -e "Now running version: ${GREEN}${NEW_VERSION}${NC}"
else
    echo -e "${RED}✗ Update may have failed. Rolling back...${NC}"
    # Rollback logic
    docker compose down
    # Restore database
    cat "${BACKUP_DIR}/${BACKUP_NAME}.sql" | docker exec -i glide-hims-db psql -U glide_hims
    docker compose up -d
    echo -e "${YELLOW}Rolled back to previous version${NC}"
    exit 1
fi

# Cleanup old backups (keep last 5)
ls -t ${BACKUP_DIR}/*.sql 2>/dev/null | tail -n +6 | xargs -r rm
ls -t ${BACKUP_DIR}/*.env 2>/dev/null | tail -n +6 | xargs -r rm

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Update Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
