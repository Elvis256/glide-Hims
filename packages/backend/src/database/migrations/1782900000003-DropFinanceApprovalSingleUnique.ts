import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint-5 (FAC-1): finance_approval_chains had a single-column UNIQUE
 * constraint on journal_entry_id, but the service inserts one row per
 * approval level for a given journal entry. The composite unique on
 * (journal_entry_id, approval_level) already exists, so the single-column
 * one is both wrong and redundant.
 *
 * Without this fix, any journal entry that requires more than one approval
 * level crashes on the second chain insert with a unique-violation error.
 */
export class DropFinanceApprovalSingleUnique1782900000003 implements MigrationInterface {
  name = 'DropFinanceApprovalSingleUnique1782900000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE finance_approval_chains
      DROP CONSTRAINT IF EXISTS finance_approval_chains_journal_entry_id_key
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-creating the broken constraint would block multi-level approvals,
    // so the down migration is a no-op (we deliberately do not restore it).
  }
}
