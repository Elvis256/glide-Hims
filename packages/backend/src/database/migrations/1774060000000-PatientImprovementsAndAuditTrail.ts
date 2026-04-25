import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientImprovementsAndAuditTrail1774060000000 implements MigrationInterface {
  name = 'PatientImprovementsAndAuditTrail1774060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Patient entity: new fields ---
    await queryRunner.query(`
      ALTER TABLE "patients"
        ADD COLUMN IF NOT EXISTS "allergies" jsonb,
        ADD COLUMN IF NOT EXISTS "marital_status" varchar(50),
        ADD COLUMN IF NOT EXISTS "occupation" varchar(255),
        ADD COLUMN IF NOT EXISTS "language" varchar(100),
        ADD COLUMN IF NOT EXISTS "photograph_url" varchar(500)
    `);

    // --- Clinical notes: audit trail fields ---
    await queryRunner.query(`
      ALTER TABLE "clinical_notes"
        ADD COLUMN IF NOT EXISTS "edit_history" jsonb,
        ADD COLUMN IF NOT EXISTS "last_edited_by_id" uuid,
        ADD COLUMN IF NOT EXISTS "last_edited_at" timestamptz
    `);

    await queryRunner.query(`
      ALTER TABLE "clinical_notes"
        ADD CONSTRAINT "FK_clinical_notes_last_edited_by"
        FOREIGN KEY ("last_edited_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // --- Patient merges table ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_merges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "primary_patient_id" uuid NOT NULL,
        "secondary_patient_id" uuid NOT NULL,
        "merged_by_id" uuid NOT NULL,
        "secondary_patient_snapshot" jsonb,
        "merged_data_summary" jsonb,
        "reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_patient_merges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_patient_merges_primary" FOREIGN KEY ("primary_patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_patient_merges_secondary" FOREIGN KEY ("secondary_patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_patient_merges_user" FOREIGN KEY ("merged_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_merges_primary" ON "patient_merges" ("primary_patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_merges_secondary" ON "patient_merges" ("secondary_patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_merges_tenant" ON "patient_merges" ("tenant_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_merges"`);

    await queryRunner.query(
      `ALTER TABLE "clinical_notes" DROP CONSTRAINT IF EXISTS "FK_clinical_notes_last_edited_by"`,
    );
    await queryRunner.query(`ALTER TABLE "clinical_notes" DROP COLUMN IF EXISTS "edit_history"`);
    await queryRunner.query(
      `ALTER TABLE "clinical_notes" DROP COLUMN IF EXISTS "last_edited_by_id"`,
    );
    await queryRunner.query(`ALTER TABLE "clinical_notes" DROP COLUMN IF EXISTS "last_edited_at"`);

    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "allergies"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "marital_status"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "occupation"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "language"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "photograph_url"`);
  }
}
