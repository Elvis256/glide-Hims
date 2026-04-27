# Air-gapped Installation

This guide installs Glide-HIMS on a server with **no internet access**.

## What you need
- Target machine: Ubuntu Server 22.04+ (or Debian 12+), x86_64, ≥4 GB RAM, ≥40 GB disk, root access.
- A USB stick prepared with `deployment/usb-iso/build-usb.sh` *or* an ISO produced by `build-iso.sh`.

## Option A — Data USB (recommended for existing servers)
1. On a build machine with internet:
   ```sh
   ./deployment/usb-iso/build-bundle.sh   # produces deployment/dist/glide-hims-fieldkit-<ver>.tar.gz
   sudo ./deployment/usb-iso/build-usb.sh /dev/sdX
   ```
2. Plug the USB into the target machine, mount it, then:
   ```sh
   sudo bash /media/*/AUTORUN.sh
   ```
3. The installer:
   - Loads pre-built Docker images (`glide-hims`, `postgres`, `nginx`)
   - Generates DB password + JWT secrets in `/opt/glide-hims/.env`
   - Generates a self-signed TLS certificate (replace later)
   - Starts the stack with docker compose
   - Waits for the `/api/v1/health` probe to return 200
4. Open `https://<server-ip>` and complete first-run setup.

## Option B — Bootable ISO (bare metal, fresh install)
```sh
./deployment/usb-iso/build-iso.sh
sudo dd if=deployment/dist/glide-hims-installer-*.iso of=/dev/sdX bs=4M status=progress conv=fsync
```
Boot the target machine from the USB. The Subiquity autoinstall flow installs Ubuntu, then runs `install.sh` automatically via `late-commands`.

## Verifying the install
```sh
docker compose -f /opt/glide-hims/docker-compose.yml ps
curl -sk https://localhost/api/v1/health
```

## Common gotchas
- **Self-signed cert warning** — replace `/opt/glide-hims/certs/{fullchain.pem,privkey.pem}` with real certs and `docker compose restart nginx`.
- **Docker not starting on cold boot** — `systemctl enable --now docker`.
- **Port 80/443 in use** — change ports in `/opt/glide-hims/docker-compose.yml` then restart.
