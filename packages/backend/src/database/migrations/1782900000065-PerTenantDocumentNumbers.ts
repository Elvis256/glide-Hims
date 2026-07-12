import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Document numbers are generated per tenant (daily/monthly sequences counted
 * within the tenant — further enforced by RLS scoping every lookup), but the
 * unique constraints were GLOBAL. With more than one tenant, two hospitals
 * reaching the same daily sequence collide on insert (unique_violation 500s).
 *
 * Converts every single-column unique constraint/index on these document
 * number columns to composite (tenant_id, number) uniqueness. Constraint and
 * index names are discovered dynamically because TypeORM's generated hash
 * names can differ between deployments.
 */
export class PerTenantDocumentNumbers1782900000065 implements MigrationInterface {
  name = 'PerTenantDocumentNumbers1782900000065';

  private static readonly TARGETS: Array<{ table: string; column: string }> = [
    { table: 'appointments', column: 'appointment_number' },
    { table: 'emergency_cases', column: 'case_number' },
    { table: 'invoices', column: 'invoice_number' },
    { table: 'orders', column: 'order_number' },
    { table: 'prescriptions', column: 'prescription_number' },
    { table: 'referrals', column: 'referral_number' },
    { table: 'payments', column: 'receipt_number' },
    { table: 'imaging_orders', column: 'order_number' },
    { table: 'surgery_cases', column: 'case_number' },
    { table: 'purchase_orders', column: 'order_number' },
    { table: 'follow_ups', column: 'appointment_number' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of PerTenantDocumentNumbers1782900000065.TARGETS) {
      // Drop every single-column UNIQUE constraint on exactly this column
      const constraints: Array<{ conname: string }> = await queryRunner.query(
        `SELECT c.conname
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = $1 AND c.contype = 'u'
            AND array_length(c.conkey, 1) = 1
            AND (SELECT attname FROM pg_attribute
                  WHERE attrelid = t.oid AND attnum = c.conkey[1]) = $2`,
        [table, column],
      );
      for (const { conname } of constraints) {
        await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${conname}"`);
      }

      // Drop leftover standalone single-column UNIQUE indexes (from @Index
      // decorators) that are not constraint-backed
      const indexes: Array<{ indexname: string }> = await queryRunner.query(
        `SELECT i.indexname
           FROM pg_indexes i
          WHERE i.schemaname = 'public' AND i.tablename = $1
            AND i.indexdef LIKE 'CREATE UNIQUE INDEX%'
            AND i.indexdef LIKE '%(' || $2 || ')%'`,
        [table, column],
      );
      for (const { indexname } of indexes) {
        await queryRunner.query(`DROP INDEX IF EXISTS "${indexname}"`);
      }

      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "UQ_${table}_tenant_number" UNIQUE ("tenant_id", "${column}")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of PerTenantDocumentNumbers1782900000065.TARGETS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "UQ_${table}_tenant_number"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "UQ_${table}_number" UNIQUE ("${column}")`,
      );
    }
  }
}
