import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * doctor_schedules was created without a tenant_id column, but the
 * SchedulesService was later tenant-hardened to filter on
 * schedule.tenant_id — every /schedules endpoint 500'd (create) or
 * silently returned empty (findAll's catch swallowed the error).
 *
 * Adds the column, backfills from the owning facility, indexes it and
 * enables the standard tenant-isolation RLS policy.
 */
export class DoctorSchedulesTenantId1782900000077 implements MigrationInterface {
  name = 'DoctorSchedulesTenantId1782900000077';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctor_schedules" ADD COLUMN IF NOT EXISTS "tenant_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "doctor_schedules" ds
      SET tenant_id = f.tenant_id
      FROM "facilities" f
      WHERE f.id = ds.facility_id AND ds.tenant_id IS NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_doctor_schedules_tenant" ON "doctor_schedules" ("tenant_id")`,
    );

    const tenantMatch = `
      current_setting('app.tenant', true) = 'system'
      OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
    `;
    await queryRunner.query(`ALTER TABLE "doctor_schedules" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "doctor_schedules"`);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "doctor_schedules"
      USING (${tenantMatch})
      WITH CHECK (${tenantMatch})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "doctor_schedules"`);
    await queryRunner.query(`ALTER TABLE "doctor_schedules" DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_doctor_schedules_tenant"`);
    await queryRunner.query(`ALTER TABLE "doctor_schedules" DROP COLUMN IF EXISTS "tenant_id"`);
  }
}
