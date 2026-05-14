import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a JSONB column for capturing triage form data (chief complaint, ESI
 * level, onset, duration, acuity, nursing notes, disposition draft) on the
 * queue entry. This lets a nurse "Save Draft" mid-assessment and resume,
 * and preserves the full triage record on disposition for downstream auditing.
 */
export class TriageDataOnQueue1782900000025 implements MigrationInterface {
  name = 'TriageDataOnQueue1782900000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "queues"
      ADD COLUMN IF NOT EXISTS "triage_data" jsonb,
      ADD COLUMN IF NOT EXISTS "triage_data_updated_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "triage_data_updated_by_id" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "queues"
      DROP COLUMN IF EXISTS "triage_data_updated_by_id",
      DROP COLUMN IF EXISTS "triage_data_updated_at",
      DROP COLUMN IF EXISTS "triage_data"
    `);
  }
}
