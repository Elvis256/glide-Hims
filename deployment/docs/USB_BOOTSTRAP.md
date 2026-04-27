# USB / ISO Bootstrap

Two media options:

## 1. Data USB
Use when the target already has Ubuntu Server installed.
```sh
./deployment/usb-iso/build-bundle.sh
sudo ./deployment/usb-iso/build-usb.sh /dev/sdX
```
Plug into target → run `sudo bash /media/*/AUTORUN.sh` → done.

## 2. Bootable ISO
Use for fresh-install scenarios.
```sh
./deployment/usb-iso/build-iso.sh
sudo dd if=deployment/dist/glide-hims-installer-*.iso of=/dev/sdX bs=4M status=progress conv=fsync
```
Boot the target from USB. Ubuntu autoinstalls, then our `late-commands` run `install.sh`.

Default credentials in the ISO: `admin / admin` (Linux user; **change immediately**). The HIMS first-run wizard creates the application admin separately.

## Customising the ISO
Edit `deployment/usb-iso/build-iso.sh` to:
- Pin a different `UBUNTU_VERSION`
- Change hostname / locale / keyboard in the autoinstall `user-data`
- Pre-load tenant-specific certs into `iso/glide/certs/`
