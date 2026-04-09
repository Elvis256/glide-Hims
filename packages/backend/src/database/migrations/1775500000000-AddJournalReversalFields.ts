import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJournalReversalFields1775500000000 implements MigrationInterface {
  name = 'AddJournalReversalFields1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        ADD COLUMN IF NOT EXISTS "is_reversal"  boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "is_reversed"  boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "reversal_of_id"  uuid,
        ADD COLUMN IF NOT EXISTS "reversed_by_id"  uuid,
        ADD COLUMN IF NOT EXISTS "reversed_at"  timestamp;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        DROP COLUMN IF EXISTS "is_reversal",
        DROP COLUMN IF EXISTS "is_reversed",
        DROP COLUMN IF EXISTS "reversal_of_id",
        DROP COLUMN IF EXISTS "reversed_by_id",
        DROP COLUMN IF EXISTS "reversed_at";
    `);
  }
}
