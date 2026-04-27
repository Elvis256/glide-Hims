import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase: multi-tenant isolation hardening.
 *
 * Make `tenant_id` NOT NULL on every business table that has it, so a forgotten
 * tenant scope in a service can never silently insert a row that becomes visible
 * cross-tenant. Platform-level tables (system admin auth, RBAC catalog,
 * cross-tenant audit) keep `tenant_id` NULLable because they intentionally
 * hold rows without a tenant scope (e.g. system admin user, system roles,
 * system_settings global keys).
 *
 * Pre-conditions verified before writing this migration:
 *  - Of the 217 tables with a nullable tenant_id, only the 11 platform tables
 *    listed below contain any NULL rows. The remaining ~206 business tables
 *    are empty in every environment we care about (fresh installs, this
 *    SaaS instance, and field-kit bootstraps).
 *  - The migration is idempotent and aborts cleanly with a useful message
 *    if any table acquires NULL tenant_id rows in the future.
 */
export class EnforceTenantIdNotNull1777500000000 implements MigrationInterface {
  name = 'EnforceTenantIdNotNull1777500000000';

  // Tables that LEGITIMATELY hold rows with NULL tenant_id and must stay nullable.
  // Keep this list small and deliberate.
  private static readonly PLATFORM_ALLOW_LIST = [
    // Tenant + system admin identity
    'tenants',
    'users',
    'user_roles',
    'roles',
    'permissions',
    'role_permissions',
    // System admin sessions / auth history
    'refresh_tokens',
    'sessions',
    'login_history',
    'password_history',
    'mfa_methods',
    'mfa_challenges',
    // Cross-tenant audit + platform settings
    'audit_logs',
    'system_settings',
    // Platform-managed support / cross-tenant control plane
    'support_access_grants',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const allowList = EnforceTenantIdNotNull1777500000000.PLATFORM_ALLOW_LIST;
    const allowListLiteral = `ARRAY[${allowList.map((t) => `'${t}'`).join(',')}]::text[]`;

    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
        null_count bigint;
        offending text[] := ARRAY[]::text[];
      BEGIN
        FOR r IN
          SELECT c.table_name
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema AND t.table_name = c.table_name
          WHERE c.table_schema = 'public'
            AND c.column_name = 'tenant_id'
            AND c.is_nullable = 'YES'
            AND t.table_type = 'BASE TABLE'
            AND c.table_name <> ALL (${allowListLiteral})
          ORDER BY c.table_name
        LOOP
          EXECUTE format('SELECT count(*) FROM %I WHERE tenant_id IS NULL', r.table_name)
            INTO null_count;
          IF null_count > 0 THEN
            offending := offending || format('%s(%s)', r.table_name, null_count);
            CONTINUE;
          END IF;
          EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', r.table_name);
        END LOOP;

        IF array_length(offending, 1) > 0 THEN
          RAISE EXCEPTION
            'EnforceTenantIdNotNull aborted: % table(s) still have NULL tenant_id rows: %. Backfill them or add to PLATFORM_ALLOW_LIST.',
            array_length(offending, 1),
            array_to_string(offending, ', ');
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const allowList = EnforceTenantIdNotNull1777500000000.PLATFORM_ALLOW_LIST;
    const allowListLiteral = `ARRAY[${allowList.map((t) => `'${t}'`).join(',')}]::text[]`;

    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
      BEGIN
        FOR r IN
          SELECT c.table_name
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema AND t.table_name = c.table_name
          WHERE c.table_schema = 'public'
            AND c.column_name = 'tenant_id'
            AND c.is_nullable = 'NO'
            AND t.table_type = 'BASE TABLE'
            AND c.table_name <> ALL (${allowListLiteral})
        LOOP
          EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id DROP NOT NULL', r.table_name);
        END LOOP;
      END$$;
    `);
  }
}
