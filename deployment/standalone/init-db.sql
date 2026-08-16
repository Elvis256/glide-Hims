-- Initial PostgreSQL setup for Glide-HIMS standalone
-- Runs once on first container start (Docker Postgres entrypoint)
-- uuid-ossp is best-effort: it needs a companion shared library that some
-- Postgres builds omit, and the entrypoint stops on the first error, so a
-- failure here would abort first-start initialisation entirely. The only
-- function this project uses from it is uuid_generate_v4(), which the
-- migration chain now provides for itself when the extension is unavailable.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'uuid-ossp unavailable (%); continuing, migrations supply uuid_generate_v4()', SQLERRM;
END
$$;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- TypeORM `synchronize: true` is disabled in production; the backend ships
-- compiled migration files which run automatically on startup.
