#!/usr/bin/env bash
# Build a self-contained "Glide-HIMS Field Kit" bundle for an air-gapped install.
# Produces a single tarball containing:
#   - Pre-built Docker image (glide-hims:VERSION)
#   - Compose stack + scripts
#   - Installer
#   - SHA-256 checksum
# Drop the tarball on a USB stick, run install.sh on the target machine.
#
# Usage: build-bundle.sh [VERSION]   (default: read from package.json)

set -euo pipefail
cd "$(dirname "$0")/../.."   # repo root

VERSION="${1:-$(node -p "require('./packages/backend/package.json').version" 2>/dev/null || echo "0.0.0")}"
BUILD_DIR="./deployment/build"
OUT_DIR="./deployment/dist"
BUNDLE="$OUT_DIR/glide-hims-fieldkit-${VERSION}.tar.gz"

mkdir -p "$BUILD_DIR" "$OUT_DIR"

log()  { printf '\033[1;34m[%s]\033[0m %s\n' "$(date +%T)" "$*"; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || fail "docker required"

log "Building Glide-HIMS image (version=$VERSION)"
docker build \
  -f deployment/standalone/Dockerfile \
  -t "glide-hims:${VERSION}" \
  -t "glide-hims:latest" \
  .

log "Saving image to image.tar (this is the largest file in the bundle)"
docker save "glide-hims:${VERSION}" -o "$BUILD_DIR/image.tar"

log "Pre-pulling auxiliary images (postgres, nginx) so target needs zero network"
for img in postgres:16-alpine nginx:1.27-alpine; do
  docker pull "$img"
done
docker save postgres:16-alpine nginx:1.27-alpine -o "$BUILD_DIR/auxiliary-images.tar"

log "Assembling staging directory"
STAGE="$BUILD_DIR/glide-hims-fieldkit-${VERSION}"
rm -rf "$STAGE"; mkdir -p "$STAGE"
cp -r deployment/standalone "$STAGE/"
cp -r deployment/scripts    "$STAGE/"
cp -r deployment/docs       "$STAGE/" 2>/dev/null || true
mv "$BUILD_DIR/image.tar"            "$STAGE/standalone/image.tar"
mv "$BUILD_DIR/auxiliary-images.tar" "$STAGE/standalone/auxiliary-images.tar"

cat > "$STAGE/INSTALL.txt" <<EOF
Glide-HIMS Field Kit  ·  v${VERSION}
=====================================

Quick start (Linux target machine, root):

  tar -xzf glide-hims-fieldkit-${VERSION}.tar.gz
  cd glide-hims-fieldkit-${VERSION}
  sudo ./standalone/install.sh \\
       --image standalone/image.tar

The installer will:
  • Install Docker if missing
  • Generate database password & JWT secrets
  • Generate a self-signed TLS cert (replace with real cert later)
  • Load the prebuilt image and start the stack
  • Set up nightly encrypted backups in /opt/glide-hims/backups

After install, open the printed URL in a browser and complete the
first-run setup wizard (admin user, hospital name, license).

For full instructions see docs/AIR_GAPPED_INSTALL.md
EOF

log "Computing per-file checksums"
( cd "$STAGE" && find . -type f -exec sha256sum {} + > SHA256SUMS )

log "Creating bundle: $BUNDLE"
tar -C "$BUILD_DIR" -czf "$BUNDLE" "glide-hims-fieldkit-${VERSION}"
sha256sum "$BUNDLE" > "${BUNDLE}.sha256"

# Cleanup staging
rm -rf "$STAGE"

log "✅ Bundle ready"
echo
ls -lh "$BUNDLE" "${BUNDLE}.sha256"
echo
echo "Next steps:"
echo "  • Copy $(basename "$BUNDLE") to a USB stick"
echo "  • Run: ./deployment/usb-iso/build-usb.sh /dev/sdX  (writes bootable USB)"
echo "  • Or:  ./deployment/usb-iso/build-iso.sh           (builds bootable ISO)"
