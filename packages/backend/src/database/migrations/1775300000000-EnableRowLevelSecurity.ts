import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable PostgreSQL Row-Level Security (RLS) on all tables that have a tenant_id column.
 *
 * How it works:
 *  1. The application sets `app.tenant_id` via SET LOCAL at the start of each request
 *     (handled by TenantInterceptor).
 *  2. RLS policies allow rows where tenant_id matches the session variable OR tenant_id IS NULL
 *     (for legacy / global rows).
 *  3. The application's DB user (non-superuser) sees only matching rows automatically.
 *
 * NOTE: Superusers and table owners bypass RLS by default.  In production the
 * application should connect as a limited-privilege role.
 */
export class EnableRowLevelSecurity1775300000000 implements MigrationInterface {
  name = 'EnableRowLevelSecurity1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Find all tables that have a tenant_id column
    await queryRunner.query(`
      DO $$
      DECLARE
        t text;
      BEGIN
        FOR t IN
          SELECT col.table_name
          FROM information_schema.columns col
          WHERE col.column_name = 'tenant_id'
            AND col.table_schema = 'public'
        LOOP
          -- Enable RLS on the table
          EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

          -- Skip if policy already exists
          CONTINUE WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = t AND policyname = 'tenant_isolation_' || t
          );

          -- Create policy: cast both sides to text to support both uuid and varchar tenant_id columns
          EXECUTE format(
            'CREATE POLICY tenant_isolation_%s ON %I
             USING (tenant_id::text = current_setting(''app.tenant_id'', true)
                    OR tenant_id IS NULL)
             WITH CHECK (tenant_id::text = current_setting(''app.tenant_id'', true)
                         OR tenant_id IS NULL)',
            t, t
          );
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        t text;
      BEGIN
        FOR t IN
          SELECT col.table_name
          FROM information_schema.columns col
          WHERE col.column_name = 'tenant_id'
            AND col.table_schema = 'public'
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%s ON %I', t, t);
          EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
        END LOOP;
      END $$;
    `);
  }
}
