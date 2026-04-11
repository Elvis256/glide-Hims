#!/bin/bash
# =============================================================================
# Glide HIMS - On-Premise Installation Script
# For customer deployment
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  _____ _ _     _        _   _ _____ __  __ _____ "
echo " / ____| (_)   | |      | | | |_   _|  \/  / ____|"
echo "| |  __| |_  __| | ___  | |_| | | | | \  / | (___  "
echo "| | |_ | | |/ _\` |/ _ \ |  _  | | | | |\/| |\___ \ "
echo "| |__| | | | (_| |  __/ | | | |_| |_| |  | |____) |"
echo " \_____|_|_|\__,_|\___| |_| |_|_____|_|  |_|_____/ "
echo -e "${NC}"
echo -e "${GREEN}Healthcare Information Management System${NC}"
echo -e "${YELLOW}On-Premise Installation${NC}\n"

# Check requirements
echo -e "${BLUE}Checking requirements...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose installed${NC}"

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/glide-hims}"
echo -e "\n${BLUE}Installation directory: ${INSTALL_DIR}${NC}"

# Create installation directory
sudo mkdir -p ${INSTALL_DIR}
cd ${INSTALL_DIR}

# Check for license key
if [ -z "${LICENSE_KEY}" ]; then
    echo -e "\n${YELLOW}Please enter your license key:${NC}"
    read -p "License Key: " LICENSE_KEY
fi

if [ -z "${LICENSE_KEY}" ]; then
    echo -e "${RED}License key is required for installation${NC}"
    exit 1
fi

# Validate license (if online)
echo -e "\n${BLUE}Validating license...${NC}"
LICENSE_VALID=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "https://hmisdemo.itsolutionsuganda.com/api/license/validate" \
    -H "Content-Type: application/json" \
    -d "{\"licenseKey\": \"${LICENSE_KEY}\"}" 2>/dev/null || echo "offline")

if [ "$LICENSE_VALID" = "200" ]; then
    echo -e "${GREEN}✓ License validated${NC}"
elif [ "$LICENSE_VALID" = "offline" ]; then
    echo -e "${YELLOW}⚠ Unable to validate license online (offline mode)${NC}"
    echo "License will be validated on first connection."
else
    echo -e "${RED}✗ Invalid license key${NC}"
    exit 1
fi

# Create .env file
echo -e "\n${BLUE}Configuring installation...${NC}"

cat > .env << EOF
# Glide HIMS Configuration
# Generated on $(date)

# Application
APP_NAME=Glide HIMS
NODE_ENV=production
DEPLOYMENT_MODE=on-premise

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=glide_hims
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)
DB_DATABASE=glide_hims

# Security
JWT_SECRET=$(openssl rand -base64 64 | tr -d '/+=' | cut -c1-64)
JWT_EXPIRATION=24h

# Ports
BACKEND_PORT=3000
FRONTEND_PORT=80

# License
LICENSE_KEY=${LICENSE_KEY}
LICENSE_SERVER_URL=https://hmisdemo.itsolutionsuganda.com/api/license

# Phone Home
PHONE_HOME_ENABLED=true
PHONE_HOME_URL=https://hmisdemo.itsolutionsuganda.com/api/phone-home
EOF

echo -e "${GREEN}✓ Configuration created${NC}"

# Copy Docker files (would be included in package)
echo -e "\n${BLUE}Setting up Docker environment...${NC}"

# Start services
echo -e "\n${BLUE}Starting Glide HIMS...${NC}"
docker compose up -d

# Wait for services
echo -e "\n${BLUE}Waiting for services to start...${NC}"
sleep 10

# Check health
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/health 2>/dev/null || echo "000")

if [ "$BACKEND_HEALTH" = "200" ] && [ "$FRONTEND_HEALTH" = "200" ]; then
    echo -e "${GREEN}✓ All services healthy${NC}"
else
    echo -e "${YELLOW}⚠ Services starting up, please wait...${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e ""
echo -e "Access Glide HIMS at: ${BLUE}http://localhost${NC}"
echo -e ""
echo -e "Default admin credentials:"
echo -e "  Username: admin"
echo -e "  Password: (set during first login)"
echo -e ""
echo -e "Configuration file: ${INSTALL_DIR}/.env"
echo -e ""
echo -e "Commands:"
echo -e "  Start:   docker compose up -d"
echo -e "  Stop:    docker compose down"
echo -e "  Logs:    docker compose logs -f"
echo -e "  Update:  ./update.sh"
echo -e ""
echo -e "${YELLOW}Support: support@itsolutionsuganda.com${NC}"
