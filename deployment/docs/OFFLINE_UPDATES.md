# Offline Updates

Standalone deployments often have no internet. We ship updates as **signed update bundles** that operators sneakernet to each site.

## Bundle format
A `.glide-update.tar.gz` containing:
- `manifest.json` — `{ version, fromVersion[], sha256, releasedAt }`
- `image.tar` — `docker save glide-hims:<new-version>`
- `migrations/*.sql` — optional, run after image swap
- `post-install.sh` — optional, runs after migrations

## Operator workflow
```sh
# 1. Inspect bundle
sudo /opt/glide-hims/scripts/update-manager.sh --check ./glide-update-1.4.0.tar.gz

# 2. Apply (auto-snapshots .env + DB before swap)
sudo /opt/glide-hims/scripts/update-manager.sh --apply ./glide-update-1.4.0.tar.gz

# 3. If the post-update health probe fails the apply auto-rolls back.
#    To roll back manually:
sudo /opt/glide-hims/scripts/update-manager.sh --rollback
```

## Safety guarantees
- SHA-256 of `image.tar` is verified against `manifest.json`.
- `fromVersion[]` gates upgrades — the bundle refuses to install on an unsupported version.
- A pre-update `pg_dump` snapshot is kept in `/opt/glide-hims/snapshots/` for one rollback.
- `--apply` polls `/api/v1/health` for 60 s after restart; on failure it automatically restores the snapshot and re-tags the previous image.

## Build (release engineer)
```sh
./deployment/usb-iso/build-bundle.sh 1.4.0
# Then wrap with manifest.json + migrations into glide-update-1.4.0.tar.gz
```
