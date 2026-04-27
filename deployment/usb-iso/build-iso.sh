#!/usr/bin/env bash
# Build a bootable Ubuntu-Server-based ISO that auto-installs Glide-HIMS.
# Approach: take an Ubuntu Server live ISO, embed our field kit bundle and
# a cloud-init/autoinstall config that runs the installer post-boot.
#
# Requires: xorriso, 7z (for ISO unpack), wget, sha256sum
#
# Usage: ./build-iso.sh [BUNDLE_TARBALL]
#
# Output: deployment/dist/glide-hims-installer-<version>.iso

set -euo pipefail
cd "$(dirname "$0")/../.."   # repo root

BUNDLE="${1:-$(ls -t deployment/dist/glide-hims-fieldkit-*.tar.gz 2>/dev/null | head -1)}"
[[ -f "$BUNDLE" ]] || { echo "No field kit bundle found. Run build-bundle.sh first."; exit 1; }

VERSION=$(basename "$BUNDLE" | sed -E 's/.*fieldkit-([0-9.]+).tar.gz/\1/')
OUT_ISO="deployment/dist/glide-hims-installer-${VERSION}.iso"
WORK=$(mktemp -d)
trap "rm -rf $WORK" EXIT

UBUNTU_VERSION="${UBUNTU_VERSION:-22.04.5}"
UBUNTU_ISO="ubuntu-${UBUNTU_VERSION}-live-server-amd64.iso"
UBUNTU_URL="https://releases.ubuntu.com/${UBUNTU_VERSION}/${UBUNTU_ISO}"

# Tooling check
for cmd in xorriso 7z wget sha256sum; do
  command -v "$cmd" >/dev/null || { echo "Missing dependency: $cmd. Install with apt."; exit 1; }
done

# Cache the Ubuntu base ISO
CACHE="$HOME/.cache/glide-hims-iso"
mkdir -p "$CACHE"
if [[ ! -f "$CACHE/$UBUNTU_ISO" ]]; then
  echo "Downloading $UBUNTU_ISO (~1.5 GB, one-time)"
  wget -O "$CACHE/$UBUNTU_ISO" "$UBUNTU_URL"
fi

# Unpack
echo "Unpacking base ISO"
mkdir -p "$WORK/iso"
7z x -y -o"$WORK/iso" "$CACHE/$UBUNTU_ISO" >/dev/null

# Embed field kit
echo "Embedding Glide-HIMS bundle ($BUNDLE)"
mkdir -p "$WORK/iso/glide"
cp "$BUNDLE" "$WORK/iso/glide/"
echo "$VERSION" > "$WORK/iso/glide/VERSION"

# Autoinstall (cloud-init / Subiquity) config
mkdir -p "$WORK/iso/server"
cat > "$WORK/iso/server/user-data" <<'YAML'
#cloud-config
autoinstall:
  version: 1
  identity:
    hostname: hims-server
    username: admin
    # Default password: admin (CHANGE on first login). Hash for "admin":
    password: "$6$rounds=4096$b8FEjC4e$AlH7s1fQXoKZrG1bMv1L9v5MHYM4Al0QlrU2eqRnkDpSmYvMvgcuBJqm9l4/7GZw8.qj8oP1J0Y0OqQwQ7Gv00"
  ssh:
    install-server: true
    allow-pw: true
  packages: [docker.io, docker-compose-plugin, curl, openssl]
  storage:
    layout: { name: lvm }
  late-commands:
    - curtin in-target -- mkdir -p /opt/glide-hims-install
    - cp -r /cdrom/glide /target/opt/glide-hims-install/
    - curtin in-target -- bash -c "cd /opt/glide-hims-install/glide && tar -xzf glide-hims-fieldkit-*.tar.gz"
    - curtin in-target -- bash -c "cd /opt/glide-hims-install/glide/glide-hims-fieldkit-* && ./standalone/install.sh --image standalone/image.tar --non-interactive"
YAML
touch "$WORK/iso/server/meta-data"

# GRUB tweak — point to our autoinstall and shorten timeout
GRUB_CFG="$WORK/iso/boot/grub/grub.cfg"
if [[ -f "$GRUB_CFG" ]]; then
  sed -i 's/timeout=30/timeout=5/' "$GRUB_CFG" || true
  sed -i '0,/menuentry/{s|---|autoinstall ds=nocloud\\;s=/cdrom/server/ ---|}' "$GRUB_CFG" || true
fi

# Re-master ISO
echo "Building $OUT_ISO (this can take a few minutes)"
mkdir -p "$(dirname "$OUT_ISO")"
xorriso -as mkisofs \
  -r -V "GLIDE_HIMS_${VERSION}" \
  -J -joliet-long -cache-inodes \
  -isohybrid-mbr "$WORK/iso/boot/grub/i386-pc/boot_hybrid.img" 2>/dev/null \
  -c boot.catalog \
  -b boot/grub/i386-pc/eltorito.img \
  -no-emul-boot -boot-load-size 4 -boot-info-table \
  -eltorito-alt-boot \
  -e EFI/boot/bootx64.efi -no-emul-boot -isohybrid-gpt-basdat \
  -o "$OUT_ISO" "$WORK/iso" 2>&1 | tail -5 || \
  xorriso -as mkisofs -r -V "GLIDE_HIMS_${VERSION}" -J -o "$OUT_ISO" "$WORK/iso"

sha256sum "$OUT_ISO" > "${OUT_ISO}.sha256"
echo "✅ ISO ready: $OUT_ISO ($(du -h "$OUT_ISO" | awk '{print $1}'))"
echo "   Write to USB:  sudo dd if=$OUT_ISO of=/dev/sdX bs=4M status=progress conv=fsync"
