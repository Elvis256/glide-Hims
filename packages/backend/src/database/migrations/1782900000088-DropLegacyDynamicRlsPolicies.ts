import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove the legacy `tenant_isolation_<table>` policies.
 *
 * EnableRowLevelSecurity1775300000000 is dynamic: it policies every table that
 * has a tenant_id column *at the moment it runs*. On existing deployments it
 * ran early, when most of the schema did not yet exist, so it covered almost
 * nothing and RlsPhase1-3 later became the real policy set — production has
 * zero `tenant_isolation_<table>` policies today. Once
 * BaselineSchema1690000000000 made the chain able to build from empty, those
 * tables now exist when the dynamic migration runs, and it policies 226 of
 * them. That silently changes behaviour in two ways:
 *
 *  1. Its policy reads `current_setting('app.tenant_id')`, but the RLS driver
 *     patch sets `app.tenant`. The GUC is never set, the comparison is NULL,
 *     and the policy degenerates to `tenant_id IS NULL` — so on the platform
 *     catalog (users, roles, permissions, sessions, ...), which Phase 3 leaves
 *     deliberately unprotected because it is read during pre-auth flows, every
 *     tenant-scoped row becomes invisible to the runtime role. A fresh install
 *     could not log anyone in.
 *  2. Where it coexists with the Phase 1-3 `tenant_isolation` policy, Postgres
 *     ORs permissive policies together, so it *widens* access — exposing
 *     NULL-tenant rows the strict policy is meant to withhold.
 *
 * Dropping them leaves RlsPhase1-3 as the single source of truth and makes a
 * database built from empty match a deployed one exactly. Inert on existing
 * deployments, which never had these policies.
 *
 * EnableRowLevelSecurity1775300000000 has since been retired to a no-op, so a
 * database built from empty never grows these policies in the first place.
 * This migration stays as the cleanup for any environment where that
 * migration did run against a populated schema and left policies behind;
 * where there are none it does nothing.
 */
export class DropLegacyDynamicRlsPolicies1782900000088 implements MigrationInterface {
  name = 'DropLegacyDynamicRlsPolicies1782900000088';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT tablename, policyname
            FROM pg_policies
           WHERE schemaname = 'public'
             AND policyname LIKE 'tenant\\_isolation\\_%'
        LOOP
          EXECUTE format('DROP POLICY %I ON %I', r.policyname, r.tablename);
        END LOOP;
      END $$;
    `);

    // A table left with RLS on and no policy denies every row to non-owners,
    // which is never what the chain intends — that is the state Phase 3
    // describes as "intentionally WITHOUT RLS".
    await queryRunner.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT c.relname
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
           WHERE c.relkind = 'r'
             AND c.relrowsecurity
             AND NOT EXISTS (
               SELECT 1 FROM pg_policies p
                WHERE p.schemaname = 'public' AND p.tablename = c.relname
             )
        LOOP
          EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.relname);
        END LOOP;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Not reversed: recreating these policies would break authentication.
  }
}
