import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guarantees `uuid_generate_v4()` resolves before any table is built with it.
 *
 * 307 column defaults across 44 migrations call `uuid_generate_v4()`, starting
 * with the very first table in BaselineSchema. The function is not part of core
 * Postgres — it ships in the uuid-ossp extension, which the chain expected to
 * be provisioned out of band (deployment/db-init/10-rls-roles.sh,
 * deployment/standalone/init-db.sql, the CI workflow). Miss that step and a
 * fresh `migration:run` dies on the first CREATE TABLE with
 *
 *     error: function uuid_generate_v4() does not exist
 *
 * which reads like a broken migration chain rather than an unprovisioned
 * database. Worse, uuid-ossp is not always installable: it needs a companion
 * shared library that some Postgres builds omit, and CREATE EXTENSION then
 * fails with `could not load library ... libossp-uuid.so`. On such a host the
 * documented provisioning step cannot succeed at all.
 *
 * Nothing here actually needs uuid-ossp. `gen_random_uuid()` has been in core
 * since Postgres 13, and this repo requires 14+, so a one-line SQL function
 * standing in for uuid_generate_v4() is equivalent everywhere we run.
 *
 * The extension is still preferred when it is available, so databases that
 * already have it keep the genuine article and nothing about their defaults
 * changes. The shim is only created when the extension cannot be installed.
 * Both paths are skipped outright when the function already exists, which is
 * every existing deployment — this migration is an inert no-op there.
 */
export class EnsureUuidGenerateV41680000000000 implements MigrationInterface {
  name = 'EnsureUuidGenerateV41680000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Already present, as an extension or otherwise: leave it alone.
        IF to_regprocedure('public.uuid_generate_v4()') IS NOT NULL THEN
          RETURN;
        END IF;

        -- Prefer the real extension. It fails when the packaged library is
        -- absent or the migration role lacks the privilege; neither is fatal,
        -- so swallow it and fall through to the shim.
        BEGIN
          CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        EXCEPTION
          WHEN OTHERS THEN NULL;
        END;

        IF to_regprocedure('public.uuid_generate_v4()') IS NULL THEN
          -- VOLATILE is the point: a STABLE/IMMUTABLE uuid generator can be
          -- folded to a single value per query, handing every inserted row the
          -- same primary key.
          CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid
            LANGUAGE sql VOLATILE AS 'SELECT gen_random_uuid()';
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Intentionally irreversible. Every table created by the chain carries a
    // default that calls this function; dropping it would break those defaults
    // and, where the extension supplied it, take uuid-ossp down with it.
  }
}
