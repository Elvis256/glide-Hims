import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint-6: version finance_approval_chains by attempt number.
 *
 * Problem
 * -------
 * Today, when a journal entry is rejected and the user resubmits,
 * `submitForApproval` deletes every previous chain row (so the
 * (journal_entry_id, approval_level) UNIQUE index can be honoured for
 * the fresh chain). The deletion wipes the audit trail of who
 * rejected what and why on prior attempts — only the latest cycle is
 * visible.
 *
 * Fix
 * ---
 * Introduce an `attempt` smallint column (1-based) and replace the
 * unique constraint with one over (journal_entry_id, approval_level,
 * attempt). The service can now create attempt = N + 1 rows on
 * resubmit while leaving the rejected chain in place. getApprovalHistory
 * already returns every row for a JE, so the full audit trail (every
 * rejection across every attempt) becomes visible to operators and
 * auditors.
 *
 * Backfill
 * --------
 * Existing rows all default to attempt = 1, which matches the
 * pre-migration semantic of "the only chain that exists for this JE"
 * — and per pre-flight there are no journal entries with multiple
 * historical chain cycles in the live DB to disambiguate.
 */
export class FinanceApprovalChainAttempt1782900000007 implements MigrationInterface {
  name = 'FinanceApprovalChainAttempt1782900000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "finance_approval_chains"
        ADD COLUMN IF NOT EXISTS "attempt" SMALLINT NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_approval_chains"
        ADD CONSTRAINT "chk_finance_approval_attempt_positive"
        CHECK ("attempt" >= 1)
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_finance_approval_journal_level"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_finance_approval_journal_level_attempt"
        ON "finance_approval_chains" ("journal_entry_id", "approval_level", "attempt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_finance_approval_journal_level_attempt"
    `);
    // Re-create the old unique index. This will fail loudly if any JE
    // has > 1 attempt rows for the same approval_level — that's the
    // correct behaviour: rolling back loses audit data and operators
    // must explicitly delete excess rows first.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_finance_approval_journal_level"
        ON "finance_approval_chains" ("journal_entry_id", "approval_level")
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_approval_chains"
        DROP CONSTRAINT IF EXISTS "chk_finance_approval_attempt_positive"
    `);
    await queryRunner.query(`
      ALTER TABLE "finance_approval_chains"
        DROP COLUMN IF EXISTS "attempt"
    `);
  }
}
