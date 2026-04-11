#!/bin/bash
# =============================================================================
# Glide HIMS - Update Package Generator
# Creates versioned update packages for on-premise installations
# =============================================================================

set -e

# Configuration
VERSION="${VERSION:-$(date +%Y.%m.%d)}"
OUTPUT_DIR="${OUTPUT_DIR:-./dist/updates}"
REGISTRY="${REGISTRY:-ghcr.io/itsolutionsuganda}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Glide HIMS Update Package Generator${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}========================================${NC}"

# Navigate to project root
cd "$(dirname "$0")/../.."
PROJECT_ROOT=$(pwd)

# Create output directory
mkdir -p ${OUTPUT_DIR}
PACKAGE_DIR="${OUTPUT_DIR}/glide-hims-${VERSION}"
rm -rf ${PACKAGE_DIR}
mkdir -p ${PACKAGE_DIR}

# Step 1: Build Docker images
echo -e "\n${YELLOW}Step 1: Building Docker images...${NC}"
./scripts/docker/build.sh

# Step 2: Export Docker images
echo -e "\n${YELLOW}Step 2: Exporting Docker images...${NC}"
mkdir -p ${PACKAGE_DIR}/images
docker save glide-hims-backend:${VERSION} -o ${PACKAGE_DIR}/images/backend.tar
docker save glide-hims-frontend:${VERSION} -o ${PACKAGE_DIR}/images/frontend.tar
echo -e "${GREEN}✓ Images exported${NC}"

# Step 3: Copy deployment files
echo -e "\n${YELLOW}Step 3: Copying deployment files...${NC}"
cp docker-compose.yml ${PACKAGE_DIR}/
cp docker-compose.prod.yml ${PACKAGE_DIR}/
cp .env.example ${PACKAGE_DIR}/.env.example
cp scripts/docker/update.sh ${PACKAGE_DIR}/update.sh
cp scripts/docker/install.sh ${PACKAGE_DIR}/install.sh

# Make scripts executable
chmod +x ${PACKAGE_DIR}/*.sh

# Step 4: Generate checksums
echo -e "\n${YELLOW}Step 4: Generating checksums...${NC}"
cd ${PACKAGE_DIR}
sha256sum images/*.tar > checksums.sha256
cd ${PROJECT_ROOT}
echo -e "${GREEN}✓ Checksums generated${NC}"

# Step 5: Create version info
echo -e "\n${YELLOW}Step 5: Creating version info...${NC}"
cat > ${PACKAGE_DIR}/VERSION << EOF
{
  "version": "${VERSION}",
  "buildDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
}
EOF
echo -e "${GREEN}✓ Version info created${NC}"

# Step 6: Generate release notes
echo -e "\n${YELLOW}Step 6: Generating release notes...${NC}"
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  echo "# Release Notes - Version ${VERSION}" > ${PACKAGE_DIR}/RELEASE_NOTES.md
  echo "" >> ${PACKAGE_DIR}/RELEASE_NOTES.md
  echo "## Changes since ${LAST_TAG}" >> ${PACKAGE_DIR}/RELEASE_NOTES.md
  git log ${LAST_TAG}..HEAD --pretty=format:"- %s" >> ${PACKAGE_DIR}/RELEASE_NOTES.md 2>/dev/null || echo "- Initial release" >> ${PACKAGE_DIR}/RELEASE_NOTES.md
else
  echo "# Release Notes - Version ${VERSION}" > ${PACKAGE_DIR}/RELEASE_NOTES.md
  echo "" >> ${PACKAGE_DIR}/RELEASE_NOTES.md
  echo "Initial release." >> ${PACKAGE_DIR}/RELEASE_NOTES.md
fi
echo -e "${GREEN}✓ Release notes generated${NC}"

# Step 7: Create README
cat > ${PACKAGE_DIR}/README.md << 'EOF'
# Glide HIMS Update Package

## Installation Instructions

### Prerequisites
- Docker and Docker Compose installed
- Valid license key

### Fresh Installation
```bash
chmod +x install.sh
./install.sh
```

### Update Existing Installation
```bash
chmod +x update.sh
OFFLINE_PACKAGE=./glide-hims-${VERSION}.tar.gz ./update.sh
```

### Manual Installation
1. Load Docker images:
   ```bash
   docker load -i images/backend.tar
   docker load -i images/frontend.tar
   ```

2. Copy .env.example to .env and configure:
   ```bash
   cp .env.example .env
   nano .env  # Edit configuration
   ```

3. Start services:
   ```bash
   docker compose up -d
   ```

### Verify Installation
```bash
curl http://localhost:3000/api/health
curl http://localhost/health
```

### Support
Email: support@itsolutionsuganda.com
EOF

# Step 8: Create tarball
echo -e "\n${YELLOW}Step 8: Creating package archive...${NC}"
cd ${OUTPUT_DIR}
tar -czf glide-hims-${VERSION}.tar.gz glide-hims-${VERSION}
PACKAGE_SIZE=$(du -h glide-hims-${VERSION}.tar.gz | cut -f1)
PACKAGE_CHECKSUM=$(sha256sum glide-hims-${VERSION}.tar.gz | cut -d' ' -f1)
echo -e "${GREEN}✓ Package created: ${PACKAGE_SIZE}${NC}"

# Step 9: Create manifest
cat > glide-hims-${VERSION}.manifest.json << EOF
{
  "version": "${VERSION}",
  "package": "glide-hims-${VERSION}.tar.gz",
  "size": "${PACKAGE_SIZE}",
  "checksum": "${PACKAGE_CHECKSUM}",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "components": {
    "backend": "glide-hims-backend:${VERSION}",
    "frontend": "glide-hims-frontend:${VERSION}"
  }
}
EOF

# Cleanup
rm -rf ${PACKAGE_DIR}

cd ${PROJECT_ROOT}

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Package Generation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e ""
echo -e "Package: ${OUTPUT_DIR}/glide-hims-${VERSION}.tar.gz"
echo -e "Size: ${PACKAGE_SIZE}"
echo -e "Checksum: ${PACKAGE_CHECKSUM}"
echo -e ""
echo -e "To upload to server:"
echo -e "  scp ${OUTPUT_DIR}/glide-hims-${VERSION}.tar.gz user@server:/path/to/updates/"
