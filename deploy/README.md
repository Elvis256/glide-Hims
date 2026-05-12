# Deploy / Rollback / Smoke

This directory holds the operational scripts for **dev** (100.83.8.43) and **prod** (hmisdemo.itsolutionsuganda.com).

## Layout (after bootstrap)

```
/root/glide-Hims/
├── repo/                            # source clone, used only for `git fetch`
├── releases/
│   ├── main_a1b2c3d4/               # full materialized release
│   ├── v1.4.0_e5f6g7h8/
│   └── v1.4.1_…/
├── shared/
│   ├── .env                         # backend env (single source)
│   ├── uploads/                     # never wiped between releases
│   └── backups/                     # pg_dumps, one per deploy
├── current → releases/v1.4.1_…      # PM2 + nginx point at this symlink
├── .previous-release                # path to prior current, for instant rollback
└── deploy/                          # these scripts
```

## Workflows

### Deploy a new version

```bash
cd /root/glide-Hims/deploy
./deploy.sh main          # dev: deploy current main branch
./deploy.sh v1.4.0        # prod: deploy a tagged release
```

`deploy.sh` will:
1. Fetch the ref from origin
2. Materialize a new dir under `releases/<ref>_<sha>/`
3. Symlink `.env` and `uploads/` from `shared/`
4. `pnpm install` (frozen lockfile) + build backend + frontend
5. **`pg_dump` the DB** to `shared/backups/pre-<ref>_<sha>_<ts>.sql.gz`
6. Run TypeORM migrations
7. **Atomic symlink swap** to point `current` at the new release
8. `pm2 reload`
9. Run `smoke.sh`. **If smoke fails → automatic rollback** to previous release.

### Roll back

```bash
./rollback.sh                     # roll back to the previous release (default)
./rollback.sh --list              # list available releases
./rollback.sh v1.4.0_e5f6g7h8     # roll back to a specific release dir
```

Rollback is just a symlink swap + `pm2 reload` — takes ~2 seconds. **Code only.** If the failed release ran a destructive migration, restore the DB separately:

```bash
./db-restore.sh /root/glide-Hims/shared/backups/pre-v1.4.1_…_20260512.sql.gz
```

### Smoke test

```bash
./smoke.sh                  # check direct backend + nginx + pm2 status
```

Exits non-zero if any check fails. Currently checks: public plans endpoint, login rejection, public tenants list, SPA index, nginx-proxied API, public pricing route, PM2 backend online status.

Add more checks by editing `smoke.sh`.

## Branching & promotion

| Branch / tag | Auto-deploys to | Trigger |
|---|---|---|
| `main` | dev (100.83.8.43) | manual `./deploy.sh main` after PR merge |
| `v*.*.*` tag | prod (hmisdemo) | manual `./deploy.sh v1.4.0` after dev sign-off |

Cut a release after dev validation:

```bash
git tag -a v1.4.0 -m "Checkpoint B: SaaS revenue extras"
git push --tags
ssh root@hmisdemo.itsolutionsuganda.com 'cd /root/glide-Hims/deploy && ./deploy.sh v1.4.0'
```

## Migration safety: expand-and-contract

To make code rollbacks safe:
- **Adding a column?** Make it nullable or have a default. Code rollback ⇒ column unused, harmless.
- **Renaming/dropping a column?** Do it in **two releases**:
  1. Release N: stop reading the old column, write to both old + new
  2. Release N+1: drop the old column

Never combine a destructive schema change with the code that depends on the new shape in the same release.

## Bootstrap (one-time per host)

To convert an existing `/root/glide-Hims` checkout into the release-dir layout:

```bash
cd /root/glide-Hims/deploy
./bootstrap.sh main
# then update nginx config:
#   root /root/glide-Hims/current/packages/frontend/dist;
# nginx -t && systemctl reload nginx
```

# deploy-cycle-test: 2026-05-12T23:09:45+02:00
