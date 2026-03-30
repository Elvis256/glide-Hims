import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantIdToAllTables1774000000000 implements MigrationInterface {
  name = 'AddTenantIdToAllTables1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add tenant_id (uuid, nullable, indexed) to every table that doesn't have it yet.
    // BaseEntity defines this column but synchronize is off, so it was never created.
    await queryRunner.query(`
      DO $$
      DECLARE
        t text;
      BEGIN
        FOR t IN
          SELECT c.table_name
          FROM information_schema.tables c
          WHERE c.table_schema = 'public'
            AND c.table_type  = 'BASE TABLE'
            AND c.table_name NOT IN ('migrations')
            AND c.table_name NOT IN (
              SELECT col.table_name
              FROM information_schema.columns col
              WHERE col.column_name = 'tenant_id'
                AND col.table_schema = 'public'
            )
        LOOP
          EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id uuid', t);
          EXECUTE format(
            'CREATE INDEX IF NOT EXISTS "IDX_%s_tenant_id" ON %I (tenant_id)',
            t, t
          );
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping tenant_id from every table would be destructive; only run in dev.
    await queryRunner.query(`
      DO $$
      DECLARE
        t text;
      BEGIN
        FOR t IN
          SELECT c.table_name
          FROM information_schema.tables c
          WHERE c.table_schema = 'public'
            AND c.table_type  = 'BASE TABLE'
            AND c.table_name NOT IN ('migrations')
            AND EXISTS (
              SELECT 1
              FROM information_schema.columns col
              WHERE col.table_name = c.table_name
                AND col.column_name = 'tenant_id'
                AND col.table_schema = 'public'
            )
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS "IDX_%s_tenant_id"', t);
          EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS tenant_id', t);
        END LOOP;
      END $$;
    `);
  }
}
