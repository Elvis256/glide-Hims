import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WHO Surgical Safety Checklist table (sign-in / time-out / sign-out per
 * surgery case). Tenant-scoped with RLS enabled from day one, per the
 * platform convention for new tenant tables.
 */
export class WhoSurgicalSafetyChecklist1782900000074 implements MigrationInterface {
  name = 'WhoSurgicalSafetyChecklist1782900000074';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "surgery_safety_checklists" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "surgery_case_id" uuid NOT NULL,
        "facility_id" uuid,
        "sign_in" jsonb,
        "sign_in_completed_by_id" uuid,
        "sign_in_completed_at" timestamptz,
        "time_out" jsonb,
        "time_out_completed_by_id" uuid,
        "time_out_completed_at" timestamptz,
        "sign_out" jsonb,
        "sign_out_completed_by_id" uuid,
        "sign_out_completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "UQ_surgery_safety_checklists_case" UNIQUE ("surgery_case_id"),
        CONSTRAINT "FK_ssc_surgery_case" FOREIGN KEY ("surgery_case_id")
          REFERENCES "surgery_cases"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ssc_tenant" ON "surgery_safety_checklists" ("tenant_id")`,
    );

    // RLS from day one (new tenant-scoped table)
    const tenantMatch = `
      current_setting('app.tenant', true) = 'system'
      OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
    `;
    await queryRunner.query(`ALTER TABLE "surgery_safety_checklists" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "surgery_safety_checklists"`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "surgery_safety_checklists"
      USING (${tenantMatch})
      WITH CHECK (${tenantMatch})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "surgery_safety_checklists"`);
  }
}
