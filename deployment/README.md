# Glide-HIMS Standalone / On-Premise Deployment

This directory bundles everything needed to ship Glide-HIMS as a self-contained on-premise product — Docker stack, installer, backup/recovery, offline updater, USB/ISO packaging, and performance tests.

```
deployment/
├── standalone/    Docker image + compose stack + bare-metal installer
├── scripts/       backup-manager.sh, restore.sh, update-manager.sh, healthcheck.sh
├── usb-iso/       build-bundle.sh, build-usb.sh, build-iso.sh
├── perf/          k6 smoke + load tests, run-perf.sh
└── docs/          AIR_GAPPED_INSTALL · BACKUP_RECOVERY · OFFLINE_UPDATES · USB_BOOTSTRAP · PERF_RESULTS
```

## Quick reference
| Task | Command |
|---|---|
| Build the field-kit bundle | `./usb-iso/build-bundle.sh` |
| Write a data USB | `sudo ./usb-iso/build-usb.sh /dev/sdX` |
| Build a bootable ISO | `./usb-iso/build-iso.sh` |
| Install on target | `sudo ./standalone/install.sh --image standalone/image.tar` |
| Manual backup | `docker compose exec backup /scripts/backup-manager.sh` |
| Restore | `sudo ./scripts/restore.sh backups/<file>.sql.gz` |
| Apply update | `sudo ./scripts/update-manager.sh --apply <bundle>` |
| Rollback | `sudo ./scripts/update-manager.sh --rollback` |
| Smoke perf | `./perf/run-perf.sh smoke` |
| Load perf | `./perf/run-perf.sh load` |

See per-topic guides under `docs/` for full instructions.

## Frontend offline mode
The frontend now tolerates short network outages:
- `src/lib/offline.ts` — periodic `/api/v1/health` probe + browser online/offline events
- `src/lib/offlineCache.ts` — IndexedDB wrapper for read-mostly stores (patients, queue, encounters)
- `src/components/OfflineBadge.tsx` — fixed-position badge that appears only when offline

By design we do **not** runtime-cache HTML, JS bundles, or API responses in a Service Worker (we previously had a stale-SW outage and won't repeat it). The kill-switch SW in `public/sw.js` remains as defence-in-depth.
