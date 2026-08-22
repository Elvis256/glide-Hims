import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Three things the emergency record could not say.
 *
 * 1. WHO closed the case. Neither the discharge nor the admit controller passed
 *    the caller down, so the discharge audit row logged `userId: undefined` and
 *    admission logged nothing at all. The department could not answer who sent
 *    a patient home, or when a decision to admit was taken and by whom.
 *
 * 2. WHICH admission the patient went to. `admitToWard` accepted a `bedId`,
 *    ignored it, wrote "Admitted to ward <uuid>" into a free-text note and left
 *    the actual IPD admission to whichever client happened to make a second
 *    call. Nothing joined the emergency case to the ward stay.
 *
 * 3. That nobody had looked at the patient yet. Every case was registered as
 *    triage level 4, "less urgent" — a green badge on the board for a patient
 *    who has not been assessed. The column becomes nullable so an untriaged
 *    case can say so; existing rows are left as they are.
 */
export class EmergencyDispositionAttribution1782900000094 implements MigrationInterface {
  name = 'EmergencyDispositionAttribution1782900000094';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "emergency_cases"
      ADD COLUMN IF NOT EXISTS "discharged_by_id" uuid,
      ADD COLUMN IF NOT EXISTS "admitted_by_id" uuid,
      ADD COLUMN IF NOT EXISTS "admitted_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "admission_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_emergency_cases_discharged_by') THEN
          ALTER TABLE "emergency_cases"
          ADD CONSTRAINT "fk_emergency_cases_discharged_by"
          FOREIGN KEY ("discharged_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_emergency_cases_admitted_by') THEN
          ALTER TABLE "emergency_cases"
          ADD CONSTRAINT "fk_emergency_cases_admitted_by"
          FOREIGN KEY ("admitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_emergency_cases_admission') THEN
          ALTER TABLE "emergency_cases"
          ADD CONSTRAINT "fk_emergency_cases_admission"
          FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`ALTER TABLE "emergency_cases" ALTER COLUMN "triage_level" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A row that never had a triage level cannot be given one on the way back,
    // so restore the NOT NULL only if nothing is null.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM "emergency_cases" WHERE "triage_level" IS NULL) THEN
          ALTER TABLE "emergency_cases" ALTER COLUMN "triage_level" SET NOT NULL;
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "emergency_cases"
      DROP COLUMN IF EXISTS "discharged_by_id",
      DROP COLUMN IF EXISTS "admitted_by_id",
      DROP COLUMN IF EXISTS "admitted_at",
      DROP COLUMN IF EXISTS "admission_id"
    `);
  }
}
