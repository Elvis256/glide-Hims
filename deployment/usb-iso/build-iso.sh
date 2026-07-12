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
for cmd in xorriso 7z wget sha256sum openssl; do
  command -v "$cmd" >/dev/null || { echo "Missing dependency: $cmd. Install with apt."; exit 1; }
done

# Unique OS credentials per ISO build — never ship a shared default password.
# The generated password is written to <iso>.credentials.txt for the
# installing technician, and the OS forces a change on first login.
ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
ADMIN_HASH="$(openssl passwd -6 "$ADMIN_PASSWORD")"

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
    # Unique per-build password (see <iso>.credentials.txt); the hash is
    # substituted below and a change is forced on first login.
    password: "__ADMIN_HASH__"
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
    # Expire the initial password so the first (console or SSH) login forces
    # the technician to set their own.
    - curtin in-target -- chage -d 0 admin
YAML
touch "$WORK/iso/server/meta-data"

# Inject the per-build password hash (heredoc above is quoted so the crypt
# string's $ characters survive; hash alphabet is [a-zA-Z0-9./$] — safe with
# the | delimiter).
sed -i "s|__ADMIN_HASH__|${ADMIN_HASH}|" "$WORK/iso/server/user-data"

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

# Credentials file for the installing technician — deliver out-of-band with
# the USB stick; do NOT copy it onto the stick itself.
CRED_FILE="${OUT_ISO}.credentials.txt"
umask 177
cat > "$CRED_FILE" <<EOF
Glide-HIMS installer ISO ${VERSION} — OS login (unique to this build)
username: admin
password: ${ADMIN_PASSWORD}
The system forces a password change on first login.
EOF
umask 022

echo "✅ ISO ready: $OUT_ISO ($(du -h "$OUT_ISO" | awk '{print $1}'))"
echo "   OS credentials: $CRED_FILE (deliver out-of-band; not on the USB stick)"
echo "   Write to USB:  sudo dd if=$OUT_ISO of=/dev/sdX bs=4M status=progress conv=fsync"
