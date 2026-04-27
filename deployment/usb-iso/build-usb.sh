#!/usr/bin/env bash
# Write a Glide-HIMS Field Kit bundle to a USB stick alongside a minimal
# autorun script, so plugging the USB into a freshly-installed Ubuntu Server
# host and running `bash /media/usb/AUTORUN.sh` performs a full install.
#
# This does NOT make the USB itself bootable (use build-iso.sh for that).
# It produces a *data USB* that's safe to write on any Linux host.
#
# Usage: sudo ./build-usb.sh /dev/sdX [bundle.tar.gz]

set -euo pipefail
DEV="${1:?USB device required, e.g. /dev/sdb}"
BUNDLE="${2:-$(ls -t deployment/dist/glide-hims-fieldkit-*.tar.gz 2>/dev/null | head -1)}"

[[ -b "$DEV" ]]      || { echo "Not a block device: $DEV"; exit 1; }
[[ -f "$BUNDLE" ]]   || { echo "Bundle not found. Run build-bundle.sh first."; exit 1; }
[[ $EUID -eq 0 ]]    || { echo "Run as root"; exit 1; }

# Refuse to write to obvious system disks
if [[ "$DEV" == "/dev/sda" || "$DEV" == "/dev/nvme0n1" ]]; then
  read -rp "⚠  $DEV looks like a system disk. Continue? Type YES: " ok
  [[ "$ok" == "YES" ]] || exit 1
fi

echo "Will WIPE and partition $DEV. All data lost."
read -rp "Type the device name to confirm ($DEV): " conf
[[ "$conf" == "$DEV" ]] || { echo "Aborted"; exit 1; }

# Unmount any existing mounts
for p in $(lsblk -ln "$DEV" -o MOUNTPOINT | grep -v '^$'); do umount -f "$p" || true; done

echo "Partitioning $DEV (single FAT32 partition, MBR)"
parted -s "$DEV" mklabel msdos
parted -s "$DEV" mkpart primary fat32 1MiB 100%
sleep 1
PART="${DEV}1"; [[ -b "${DEV}p1" ]] && PART="${DEV}p1"
mkfs.vfat -F32 -n GLIDE_HIMS "$PART"

MNT=$(mktemp -d)
mount "$PART" "$MNT"

echo "Copying bundle and autorun"
cp "$BUNDLE" "$MNT/"
BUNDLE_NAME=$(basename "$BUNDLE")

cat > "$MNT/AUTORUN.sh" <<EOF
#!/usr/bin/env bash
# Run this from the USB on the target machine: sudo bash AUTORUN.sh
set -euo pipefail
HERE="\$(cd -- "\$(dirname -- "\${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
cd /opt
tar -xzf "\$HERE/${BUNDLE_NAME}"
DIR=\$(tar -tzf "\$HERE/${BUNDLE_NAME}" | head -1 | cut -d/ -f1)
cd "\$DIR"
sudo ./standalone/install.sh --image standalone/image.tar
EOF
chmod +x "$MNT/AUTORUN.sh"

cat > "$MNT/README.txt" <<'EOF'
Glide-HIMS Field Kit USB
========================

To install on a target machine:
  1. Plug this USB into a Linux server (Ubuntu 22.04+ recommended)
  2. Mount the USB (most desktop systems do this automatically)
  3. Open a terminal in the USB folder
  4. Run:  sudo bash AUTORUN.sh

The installer takes ~5 minutes the first time (mostly importing
Docker images). Subsequent updates are much faster.
EOF

sync
umount "$MNT"
rmdir "$MNT"
echo "✅ USB ready. Eject before unplugging."
