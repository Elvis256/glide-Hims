import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add a foreign key constraint on tenant_id → tenants.id for all tables that have a
 * tenant_id column.  This enforces referential integrity at the database level.
 *
 * We do NOT set NOT NULL yet because existing rows may still have NULL tenant_id
 * values.  Run a backfill first, then a follow-up migration to add NOT NULL.
 */
export class AddTenantIdForeignKeys1775400000000 implements MigrationInterface {
  name = 'AddTenantIdForeignKeys1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add FK constraint on every table with tenant_id, skipping the tenants table itself
    await queryRunner.query(`
      DO $$
      DECLARE
        t text;
        fk_name text;
      BEGIN
        FOR t IN
          SELECT col.table_name
          FROM information_schema.columns col
          WHERE col.column_name = 'tenant_id'
            AND col.table_schema = 'public'
            AND col.table_name != 'tenants'
            AND col.table_name != 'migrations'
            AND col.data_type = 'uuid'
            AND NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND kcu.column_name = 'tenant_id'
                AND kcu.table_name = col.table_name
                AND kcu.table_schema = 'public'
            )
        LOOP
          fk_name := 'FK_' || t || '_tenant_id';
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT',
            t, fk_name
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
        fk_name text;
      BEGIN
        FOR t IN
          SELECT col.table_name
          FROM information_schema.columns col
          WHERE col.column_name = 'tenant_id'
            AND col.table_schema = 'public'
            AND col.table_name != 'tenants'
        LOOP
          fk_name := 'FK_' || t || '_tenant_id';
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, fk_name);
        END LOOP;
      END $$;
    `);
  }
}
