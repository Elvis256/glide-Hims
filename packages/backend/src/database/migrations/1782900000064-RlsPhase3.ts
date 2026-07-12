import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Row-Level Security — Phase 3 (platform-admin domain tables).
 *
 * Completes RLS coverage: these tables were excluded in Phase 2 because
 * system admins reached them through ordinary endpoints with no tenant
 * context. TenantInterceptor now gives system admins an explicit context —
 * `app.tenant = 'system'` cross-tenant (mutations logged), or a scoped
 * tenant via ?tenantId= — and trusted public entry points (phone-home,
 * payment webhooks, portal OTP, setup bootstrap, installer/license
 * validation, careers pages) run under withSystemContext/withTenant.
 *
 * - Strict tenant policy: licenses, saas_contracts, client_onboardings,
 *   onboarding_tasks, deployments, deployment_reports, backups,
 *   backup_schedules, webhook_delivery_logs, tenant_feature_modules
 * - feature_flags: global rows (tenant_id IS NULL) readable by all tenants,
 *   writes tenant-scoped (global flags managed in system context)
 * - backups + onboarding_tasks tenant_id normalized varchar -> uuid
 *
 * Still intentionally WITHOUT RLS (platform catalog, NULL tenant is
 * legitimate and they are queried during pre-auth flows): users, roles,
 * permissions, role_permissions, user_roles, user_permissions, sessions,
 * refresh_tokens, login_history, password_history, audit_logs,
 * system_settings, support_access_grants/requests, tenants,
 * system_admin_roles/assignments, system_metrics, admin_audit_log,
 * compliance_evidence.
 */
export class RlsPhase31782900000064 implements MigrationInterface {
  name = 'RlsPhase31782900000064';

  private static readonly STRICT_TABLES = [
    'licenses',
    'saas_contracts',
    'client_onboardings',
    'onboarding_tasks',
    'deployments',
    'deployment_reports',
    'backups',
    'backup_schedules',
    'webhook_delivery_logs',
    'tenant_feature_modules',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "backups" ALTER COLUMN "tenant_id" TYPE uuid USING tenant_id::uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "onboarding_tasks" ALTER COLUMN "tenant_id" TYPE uuid USING tenant_id::uuid`,
    );

    const tenantMatch = `
      current_setting('app.tenant', true) = 'system'
      OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
    `;

    for (const table of RlsPhase31782900000064.STRICT_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING (${tenantMatch})
        WITH CHECK (${tenantMatch})
      `);
    }

    // feature_flags: global flags (tenant_id IS NULL) visible to every tenant.
    await queryRunner.query(`ALTER TABLE "feature_flags" ENABLE ROW LEVEL SECURITY`);
    for (const p of ['tenant_isolation', 'tenant_read', 'tenant_insert', 'tenant_update', 'tenant_delete']) {
      await queryRunner.query(`DROP POLICY IF EXISTS "${p}" ON "feature_flags"`);
    }
    await queryRunner.query(`
      CREATE POLICY "tenant_read" ON "feature_flags" FOR SELECT
      USING (
        current_setting('app.tenant', true) = 'system'
        OR tenant_id IS NULL
        OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
      )
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_insert" ON "feature_flags" FOR INSERT
      WITH CHECK (${tenantMatch})
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_update" ON "feature_flags" FOR UPDATE
      USING (${tenantMatch}) WITH CHECK (${tenantMatch})
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_delete" ON "feature_flags" FOR DELETE
      USING (${tenantMatch})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of RlsPhase31782900000064.STRICT_TABLES) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
    for (const p of ['tenant_read', 'tenant_insert', 'tenant_update', 'tenant_delete']) {
      await queryRunner.query(`DROP POLICY IF EXISTS "${p}" ON "feature_flags"`);
    }
    await queryRunner.query(`ALTER TABLE "feature_flags" DISABLE ROW LEVEL SECURITY`);
  }
}
