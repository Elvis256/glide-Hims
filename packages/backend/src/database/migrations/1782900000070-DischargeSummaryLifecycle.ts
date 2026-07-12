import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Discharge summary document lifecycle: draft (editable) → finalized
 * (frozen) → signed. Existing rows stay 'draft' so current editing
 * behavior is unchanged; the lifecycle applies going forward.
 */
export class DischargeSummaryLifecycle1782900000070 implements MigrationInterface {
  name = 'DischargeSummaryLifecycle1782900000070';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discharge_summaries"
         ADD COLUMN IF NOT EXISTS "document_status" varchar(20) NOT NULL DEFAULT 'draft',
         ADD COLUMN IF NOT EXISTS "finalized_by_id" uuid,
         ADD COLUMN IF NOT EXISTS "finalized_at" timestamptz,
         ADD COLUMN IF NOT EXISTS "signed_by_id" uuid,
         ADD COLUMN IF NOT EXISTS "signed_at" timestamptz`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_discharge_summaries_document_status"
         ON "discharge_summaries" ("document_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_discharge_summaries_document_status"`);
    await queryRunner.query(
      `ALTER TABLE "discharge_summaries"
         DROP COLUMN IF EXISTS "document_status",
         DROP COLUMN IF EXISTS "finalized_by_id",
         DROP COLUMN IF EXISTS "finalized_at",
         DROP COLUMN IF EXISTS "signed_by_id",
         DROP COLUMN IF EXISTS "signed_at"`,
    );
  }
}
