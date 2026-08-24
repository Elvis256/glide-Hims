import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Leaving recovery was not recorded anywhere.
 *
 * completeSurgery set `discharge_from_theatre` to the moment the operation
 * ended — the patient leaving the OR for PACU, which is what that column
 * means. dischargeFromRecovery then flipped the status to COMPLETED and wrote
 * nothing at all: no time, no user, no notes. So the interval a patient spent
 * in post-anaesthesia recovery, which is a safety metric and the handover point
 * to the ward, could not be derived from the record, and nobody was named as
 * having made the decision to move them.
 */
export class SurgeryRecoveryDischarge1782900000092 implements MigrationInterface {
  name = 'SurgeryRecoveryDischarge1782900000092';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "surgery_cases"
      ADD COLUMN IF NOT EXISTS "recovery_discharged_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "recovery_discharged_by_id" uuid
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_surgery_cases_recovery_discharged_by'
        ) THEN
          ALTER TABLE "surgery_cases"
          ADD CONSTRAINT "fk_surgery_cases_recovery_discharged_by"
          FOREIGN KEY ("recovery_discharged_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "surgery_cases"
      DROP CONSTRAINT IF EXISTS "fk_surgery_cases_recovery_discharged_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "surgery_cases"
      DROP COLUMN IF EXISTS "recovery_discharged_by_id",
      DROP COLUMN IF EXISTS "recovery_discharged_at"
    `);
  }
}
