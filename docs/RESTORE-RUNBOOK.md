# Restoring a glide-HIMS backup

Verified end to end on 2026-08-26 against a real production backup
(`glide_hims_daily_20260826_020001.sql`), restored on the offsite machine into
a scratch database: 338 tables, 20 patients, 30 users, 157 migrations.

Read the two traps first. Both produce failures that look like a corrupt
backup and are not.

---

## Trap 1 — the file is not SQL, despite the `.sql` name

`backup.sh` writes a PostgreSQL **custom-format** dump (`PGDMP` magic bytes)
and names it `.sql`.

    $ file -b glide_hims_daily_20260826_020001.sql
    PostgreSQL custom database dump - v1.15-0

Piping it to `psql` silently does nothing: no error, no tables, exit 0. It must
be restored with `pg_restore`, which is what `scripts/restore.sh` does.

If a restore "succeeds" and the database is empty, this is why.

## Trap 2 — `uuid_generate_v4()` must exist BEFORE the restore

Production has the `uuid-ossp` extension. This machine could not load it until
2026-08-26 — `libossp-uuid.so.16` was absent, so `CREATE EXTENSION "uuid-ossp"`
failed.

**That is now fixed here** (see step 5): the library was fetched with
`apt-get download libossp-uuid16`, unpacked with `dpkg-deb -x`, and its
`libossp-uuid*.so.16*` files copied into `/home/avis/opt/pgsql/lib-compat` —
the private dir Postgres already needs to start, on `LD_LIBRARY_PATH` in the
systemd unit. No sudo, no restart. `CREATE EXTENSION "uuid-ossp"` now succeeds.

Keep reading anyway. **The trap still applies to any other restore host**, and
it is the failure you will meet at 3am on a machine nobody prepared.

Almost every table declares `DEFAULT uuid_generate_v4()`, so when that function
is missing, every one of those `CREATE TABLE` statements fails too:

    pg_restore: error: ... could not load library ".../uuid-ossp.so"
    pg_restore: error: ... function public.uuid_generate_v4() does not exist
    ... 2860 more

**2861 errors, 28 of 338 tables restored.** It reads exactly like a corrupt
archive. It is one missing extension, cascading.

Make `uuid_generate_v4()` exist before restoring — the real extension where it
loads, a shim where it does not — and the same archive restores cleanly.

---

## Procedure

```bash
# 1. Locate a backup. Offsite copies are pulled nightly at 03:30 to:
ls -t ~/glide-hims-offsite/daily/*.sql | head

# 2. If it ends in .gpg, decrypt it first. The passphrase is NOT on either
#    host by design — it is in the password manager.
gpg --batch --decrypt --passphrase-file <passphrase-file> \
    --output restored.sql glide_hims_daily_YYYYMMDD_HHMMSS.sql.gpg

# 3. Verify integrity. Compare the HASH, not the path: the .sha256 has
#    production's absolute path baked in, so `sha256sum -c` on another machine
#    reports "FAILED open or read" for a perfectly good file.
awk '{print $1}' backup.sql.sha256
sha256sum restored.sql | awk '{print $1}'      # these must match

# 4. Confirm the archive is readable before touching any database.
pg_restore --list restored.sql | wc -l          # expect ~3700 entries

# 5. Create the target database and make uuid_generate_v4() exist (Trap 2).
#    Prefer the real extension; fall back to a shim only where it cannot load.
createdb -h 127.0.0.1 -p 5433 -U avis glide_restored
psql -h 127.0.0.1 -p 5433 -U avis -d glide_restored -c \
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' \
  || psql -h 127.0.0.1 -p 5433 -U avis -d glide_restored -c \
  "CREATE OR REPLACE FUNCTION public.uuid_generate_v4() RETURNS uuid
     LANGUAGE sql VOLATILE AS \$\$ SELECT gen_random_uuid() \$\$;"
#    gen_random_uuid() is built into Postgres 13+ and returns a real v4 UUID.
#    The older md5(random()||clock_timestamp())::uuid shim does not — it has no
#    version or variant bits — which is fine for restoring but wrong to leave
#    behind in a database that then generates its own ids.

# 6. Restore.
pg_restore -h 127.0.0.1 -p 5433 -U glide_hims_app -d glide_restored \
           --no-owner --no-privileges restored.sql

# 7. Verify it is a working database, not just a set of empty tables.
psql -d glide_restored -tAc "SET app.tenant='system';
  SELECT 'tables='||(SELECT count(*) FROM information_schema.tables
                     WHERE table_schema='public')
      ||' patients='||(SELECT count(*) FROM patients)
      ||' migrations='||(SELECT count(*) FROM migrations);"
```

Expect roughly `tables=338 patients=20 migrations=157` for the 2026-08-26
backup. Row counts grow with real use; the table and migration counts should
match production.

Note the RLS requirement: `SET app.tenant` is needed before most queries return
anything. A restored database that looks empty may simply not have the tenant
GUC set.

---

## Restoring ONTO production

Everything above targets a scratch database. Overwriting the live one is a
different act: stop the app first, take a fresh backup of the current state
even though you are replacing it, and restore into a new database then rename,
so there is a moment where both exist and you can still change your mind.

`scripts/restore.sh <file>` handles the decrypt-and-pg_restore path, but read
it before running it against anything that matters.

---

## Version compatibility

Production dumps with `pg_dump 16.15`; the offsite machine restores with
`pg_restore 16.4`. Same major version, and the restore verified clean. If
production is ever upgraded to PostgreSQL 17+, the offsite machine's client
tools must be upgraded too — a newer archive cannot be read by older
`pg_restore`, and the failure would only surface during a disaster.
