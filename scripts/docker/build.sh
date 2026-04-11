#!/bin/bash
# =============================================================================
# Glide HIMS - Docker Build Script
# Builds and tags Docker images for distribution
# =============================================================================

set -e

# Configuration
REGISTRY="${REGISTRY:-ghcr.io/itsolutionsuganda}"
VERSION="${VERSION:-$(date +%Y%m%d)}"
TAG="${TAG:-$VERSION}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Glide HIMS Docker Build${NC}"
echo -e "${GREEN}Version: ${TAG}${NC}"
echo -e "${GREEN}========================================${NC}"

# Navigate to project root
cd "$(dirname "$0")/../.."

# Build backend
echo -e "\n${YELLOW}Building Backend...${NC}"
docker build \
    -t glide-hims-backend:${TAG} \
    -t glide-hims-backend:latest \
    -t ${REGISTRY}/glide-hims-backend:${TAG} \
    -t ${REGISTRY}/glide-hims-backend:latest \
    -f packages/backend/Dockerfile \
    packages/backend

echo -e "${GREEN}✓ Backend built successfully${NC}"

# Build frontend
echo -e "\n${YELLOW}Building Frontend...${NC}"
docker build \
    -t glide-hims-frontend:${TAG} \
    -t glide-hims-frontend:latest \
    -t ${REGISTRY}/glide-hims-frontend:${TAG} \
    -t ${REGISTRY}/glide-hims-frontend:latest \
    -f packages/frontend/Dockerfile \
    packages/frontend

echo -e "${GREEN}✓ Frontend built successfully${NC}"

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Build Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Images created:"
echo -e "  - glide-hims-backend:${TAG}"
echo -e "  - glide-hims-frontend:${TAG}"
echo -e ""
echo -e "To push to registry:"
echo -e "  docker push ${REGISTRY}/glide-hims-backend:${TAG}"
echo -e "  docker push ${REGISTRY}/glide-hims-frontend:${TAG}"
