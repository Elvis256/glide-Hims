import { MigrationInterface, QueryRunner } from 'typeorm';

/** Partograph observations table (WHO labour charting), RLS'd from day one. */
export class PartographObservations1782900000075 implements MigrationInterface {
  name = 'PartographObservations1782900000075';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partograph_observations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "labour_record_id" uuid NOT NULL,
        "facility_id" uuid,
        "observed_at" timestamptz NOT NULL,
        "cervical_dilation_cm" smallint,
        "descent_fifths" smallint,
        "contractions_per_10min" smallint,
        "contraction_duration_seconds" smallint,
        "fetal_heart_rate" smallint,
        "liquor" varchar(20),
        "moulding" varchar(4),
        "pulse" smallint,
        "bp_systolic" smallint,
        "bp_diastolic" smallint,
        "temperature" numeric(4,1),
        "urine_output" varchar(30),
        "urine_protein" varchar(10),
        "urine_acetone" varchar(10),
        "oxytocin_units_per_litre" numeric(5,2),
        "oxytocin_drops_per_min" smallint,
        "notes" text,
        "recorded_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "FK_partograph_labour" FOREIGN KEY ("labour_record_id")
          REFERENCES "labour_records"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partograph_labour_time"
         ON "partograph_observations" ("labour_record_id", "observed_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_partograph_tenant" ON "partograph_observations" ("tenant_id")`,
    );

    const tenantMatch = `
      current_setting('app.tenant', true) = 'system'
      OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
    `;
    await queryRunner.query(`ALTER TABLE "partograph_observations" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "partograph_observations"`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "partograph_observations"
      USING (${tenantMatch})
      WITH CHECK (${tenantMatch})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "partograph_observations"`);
  }
}
