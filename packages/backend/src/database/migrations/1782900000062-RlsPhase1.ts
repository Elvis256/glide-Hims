import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Row-Level Security — Phase 1 (pilot tables).
 *
 * Defense-in-depth under the application-level requireTenantId() filters:
 * policies scope every read/write to the tenant carried in the `app.tenant`
 * GUC, which the RLS driver patch (common/database/rls-driver-patch.ts) sets
 * on every query from the AsyncLocalStorage request context.
 *
 * GUC contract:
 *   'system'  -> full visibility (trusted background jobs / platform endpoints)
 *   <uuid>    -> rows of that tenant only
 *   ''        -> no rows (default-deny; e.g. system admin without tenant)
 *
 * IMPORTANT OPERATIONAL NOTES:
 * - RLS only applies to NON-OWNER roles. The app must connect as the
 *   `glide_hims_runtime` role (not the table owner `glide_hims_app`).
 *   Migrations keep running as the owner and are unaffected.
 * - The `(SELECT ...)` wrapper in the policies makes Postgres evaluate the
 *   GUC once per statement (InitPlan) instead of per row.
 * - Pilot scope: patient clinical/PII tables + clinical billing. The SaaS
 *   platform tables (saas_invoices, subscriptions, ...) are intentionally
 *   NOT covered — they are platform-admin domain.
 */
export class RlsPhase11782900000062 implements MigrationInterface {
  name = 'RlsPhase11782900000062';

  private static readonly TABLES = [
    'patients',
    'patient_documents',
    'patient_notes',
    'patient_consents',
    'invoices',
    'invoice_items',
    'payments',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of RlsPhase11782900000062.TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING (
          current_setting('app.tenant', true) = 'system'
          OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
        )
        WITH CHECK (
          current_setting('app.tenant', true) = 'system'
          OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of RlsPhase11782900000062.TABLES) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}
