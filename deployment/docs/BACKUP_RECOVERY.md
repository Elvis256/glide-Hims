# Backup & Recovery

## What gets backed up
- PostgreSQL database (`glide_hims_dev`) via `pg_dump`, gzipped, optionally GPG-encrypted
- Uploads directory (`/opt/glide-hims/uploads`)
- A `.sha256` sidecar for integrity verification

Everything is stored in `/opt/glide-hims/backups/` with retention controlled by `BACKUP_RETENTION_DAYS` (default 90).

## Schedule
A `backup` service in `docker-compose.yml` runs `backup-manager.sh` nightly at 02:00. The cron line lives inside that container.

## Manual backup
```sh
docker compose exec backup /scripts/backup-manager.sh
```

## List & verify
```sh
/opt/glide-hims/scripts/backup-manager.sh --list
/opt/glide-hims/scripts/backup-manager.sh --verify backups/2025-01-15.sql.gz
```

## Restore
```sh
sudo /opt/glide-hims/scripts/restore.sh /opt/glide-hims/backups/2025-01-15.sql.gz
```
The script:
1. Verifies the SHA-256 sidecar
2. Decrypts (if `BACKUP_ENCRYPTION_KEY` set)
3. Stops the backend container
4. Drops & recreates the target database
5. Restores the dump and uploads tar
6. Restarts the backend

## Encryption key custody
`BACKUP_ENCRYPTION_KEY` lives in `/opt/glide-hims/.env`. **Keep an offline copy.** A backup without its key is unrecoverable.
