#!/usr/bin/env bash
# Build a Glide HIMS installer tarball for distribution.
# Usage: ./scripts/build-installer.sh [version]
set -euo pipefail

VERSION="${1:-1.0.0}"
PLATFORM="${PLATFORM:-linux-amd64}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${INSTALLERS_DIR:-/var/lib/glide-hims/installers}"
NAME="glide-hims-${VERSION}-${PLATFORM}.tar.gz"
TARGET="${OUT_DIR}/${NAME}"

mkdir -p "${OUT_DIR}"

echo "→ Packing repo into ${TARGET}"
tar --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./packages/*/node_modules' \
    --exclude='./packages/frontend/dist' \
    --exclude='./packages/backend/dist' \
    --exclude='./.copilot' \
    --exclude='./tmp' \
    -czf "${TARGET}" \
    -C "${REPO_ROOT}" .

SIZE=$(stat -c%s "${TARGET}")
SHA=$(sha256sum "${TARGET}" | awk '{print $1}')

echo
echo "✔ Built ${NAME}"
echo "  Path:   ${TARGET}"
echo "  Size:   ${SIZE} bytes"
echo "  SHA256: ${SHA}"
echo
echo "Register it via /system/downloads with these values, or POST /api/v1/downloads:"
cat <<JSON
{
  "name": "Glide HIMS",
  "version": "${VERSION}",
  "channel": "stable",
  "kind": "tarball",
  "platform": "${PLATFORM}",
  "filename": "${NAME}",
  "sizeBytes": "${SIZE}",
  "sha256": "${SHA}",
  "isPublished": true
}
JSON
