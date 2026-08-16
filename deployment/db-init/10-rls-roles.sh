#!/bin/sh
# Provision the RLS runtime role for Glide-HIMS.
#
# The application must connect as a NON-OWNER role so PostgreSQL row-level
# security applies to it (RLS never applies to the table owner). Migrations
# keep running as the owner ($POSTGRES_USER), which bypasses RLS by design.
#
# Runs via the official postgres image entrypoint (docker-entrypoint-initdb.d)
# on FIRST initialization of the data volume only. For existing installs run
# this once manually:  docker exec -i <postgres-container> sh < this-file
#
# Required env on the postgres service: DB_RUNTIME_PASSWORD
# (avoid single quotes in the password — it is interpolated into SQL below).
set -e

: "${DB_RUNTIME_PASSWORD:?DB_RUNTIME_PASSWORD must be set for the RLS runtime role}"

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
-- uuid-ossp is best-effort. It needs a companion shared library that some
-- Postgres builds omit, and with ON_ERROR_STOP a failure here would abort the
-- script before the runtime role is created — losing role provisioning, this
-- script's actual purpose, to a missing optional extension. The only function
-- this project uses from it is uuid_generate_v4(), which the migration chain
-- now provides for itself when the extension is unavailable.
DO \$\$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'uuid-ossp unavailable (%); continuing, migrations supply uuid_generate_v4()', SQLERRM;
END
\$\$;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'glide_hims_runtime') THEN
    CREATE ROLE glide_hims_runtime LOGIN PASSWORD '${DB_RUNTIME_PASSWORD}';
  ELSE
    ALTER ROLE glide_hims_runtime WITH LOGIN PASSWORD '${DB_RUNTIME_PASSWORD}';
  END IF;
END
\$\$;

GRANT USAGE ON SCHEMA public TO glide_hims_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO glide_hims_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO glide_hims_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO glide_hims_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO glide_hims_runtime;
SQL

echo "Glide-HIMS RLS runtime role provisioned."
