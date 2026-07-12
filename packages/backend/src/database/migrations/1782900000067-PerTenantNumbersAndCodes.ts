import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Third pass on global-unique tenant data (see 1782900000065/66):
 *
 * 1. camelCase document-number columns missed by the case-sensitive sweep:
 *    admissions."admissionNumber", lab_samples."sampleNumber",
 *    sample_referrals."referralNumber".
 *
 * 2. Tenant-DEFINED code columns (wards, departments, services, items, ...).
 *    Every hospital wants ward code "ICU" and department "OPD" — the second
 *    tenant to onboard collides with unique_violation 500s.
 *
 * Excluded on purpose: permissions.code (platform catalog),
 * saas_contracts."contractNumber" (platform-wide generator, global by design).
 *
 * services additionally keeps a partial unique index on code WHERE
 * tenant_id IS NULL to protect the global NULL-tenant catalog rows that its
 * RLS split policy permits.
 */
export class PerTenantNumbersAndCodes1782900000067 implements MigrationInterface {
  name = 'PerTenantNumbersAndCodes1782900000067';

  private static readonly TARGETS: Array<{ table: string; column: string }> = [
    // camelCase document numbers
    { table: 'admissions', column: 'admissionNumber' },
    { table: 'lab_samples', column: 'sampleNumber' },
    { table: 'sample_referrals', column: 'referralNumber' },
    // tenant-defined codes
    { table: 'billing_points', column: 'code' },
    { table: 'departments', column: 'code' },
    { table: 'donor_funds', column: 'fund_code' },
    { table: 'insurance_providers', column: 'code' },
    { table: 'items', column: 'code' },
    { table: 'membership_schemes', column: 'code' },
    { table: 'queue_displays', column: 'display_code' },
    { table: 'service_categories', column: 'code' },
    { table: 'service_packages', column: 'code' },
    { table: 'services', column: 'code' },
    { table: 'stores', column: 'code' },
    { table: 'suppliers', column: 'code' },
    { table: 'tax_rates', column: 'code' },
    { table: 'theatres', column: 'code' },
    { table: 'wards', column: 'code' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of PerTenantNumbersAndCodes1782900000067.TARGETS) {
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

      const indexes: Array<{ indexname: string }> = await queryRunner.query(
        `SELECT i.indexname
           FROM pg_indexes i
          WHERE i.schemaname = 'public' AND i.tablename = $1
            AND i.indexdef LIKE 'CREATE UNIQUE INDEX%'
            AND (i.indexdef LIKE '%(' || $2 || ')%' OR i.indexdef LIKE '%("' || $2 || '")%')`,
        [table, column],
      );
      for (const { indexname } of indexes) {
        await queryRunner.query(`DROP INDEX IF EXISTS "${indexname}"`);
      }

      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "UQ_${table}_tenant_${column}" UNIQUE ("tenant_id", "${column}")`,
      );
    }

    // Global NULL-tenant service catalog rows still need unique codes
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_services_global_code" ON "services" ("code") WHERE tenant_id IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_services_global_code"`);
    for (const { table, column } of PerTenantNumbersAndCodes1782900000067.TARGETS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "UQ_${table}_tenant_${column}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "UQ_${table}_${column}" UNIQUE ("${column}")`,
      );
    }
  }
}
