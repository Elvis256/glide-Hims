-- Initial PostgreSQL setup for Glide-HIMS standalone
-- Runs once on first container start (Docker Postgres entrypoint)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- TypeORM `synchronize: true` is disabled in production; the backend ships
-- compiled migration files which run automatically on startup.
