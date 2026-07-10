import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint-6: defence-in-depth constraints for the GL.
 *
 * Three independent hardenings, all of which are also enforced in the
 * service layer but were missing as DB-level invariants — meaning a
 * stray ad-hoc UPDATE, a buggy migration, or a future endpoint that
 * forgets the validation could silently corrupt the books.
 *
 * 1. journal_entry_lines.debit/credit XOR
 *    Every line must have exactly one of {debit > 0, credit > 0}.
 *    Both 0 (no-op posting) or both > 0 (impossible double-sided line)
 *    are rejected. Negative values are also forbidden — sign is
 *    expressed by which side carries the value.
 *
 * 2. journal_entries.reversal_of_id / reversed_by_id FKs
 *    `reversal_of_id` points at the original posted JE this reversal
 *    cancels — it must reference a real journal entry. ON DELETE
 *    RESTRICT prevents the original from being deleted while a
 *    reversal still references it (we never actually delete, but the
 *    FK guarantees referential integrity if we ever did).
 *    `reversed_by_id` records the USER who performed the reversal —
 *    references users(id), ON DELETE SET NULL so user deletion does
 *    not cascade to journal data (audit trail loss is acceptable here
 *    if a user account is purged).
 *
 * 3. journal_entries no-reversal-of-reversal CHECK
 *    A row that itself is a reversal (is_reversal = true) must never
 *    also be marked as reversed (is_reversed = true). The service
 *    already throws BadRequestException, but the DB CHECK closes the
 *    loophole if anyone bypasses the service layer with raw SQL or a
 *    future repo write.
 *
 * Pre-flight check (run during development):
 *   SELECT count(*) FROM journal_entry_lines
 *    WHERE NOT (debit >= 0 AND credit >= 0
 *               AND ((debit > 0 AND credit = 0)
 *                  OR (debit = 0 AND credit > 0)));
 *   -- expected: 0
 *
 *   SELECT count(*) FROM journal_entries
 *    WHERE is_reversal = true AND is_reversed = true;
 *   -- expected: 0
 *
 *   SELECT count(*) FROM journal_entries je
 *    WHERE reversal_of_id IS NOT NULL
 *      AND NOT EXISTS (SELECT 1 FROM journal_entries x WHERE x.id = je.reversal_of_id);
 *   -- expected: 0
 *
 *   SELECT count(*) FROM journal_entries je
 *    WHERE reversed_by_id IS NOT NULL
 *      AND NOT EXISTS (SELECT 1 FROM users x WHERE x.id = je.reversed_by_id);
 *   -- expected: 0
 *
 * Live DB confirmed all four return 0 prior to this migration.
 */
export class FinanceConstraintsHardening1782900000006 implements MigrationInterface {
  name = 'FinanceConstraintsHardening1782900000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. JEL debit/credit XOR
    await queryRunner.query(`
      ALTER TABLE "journal_entry_lines"
        DROP CONSTRAINT IF EXISTS "chk_jel_debit_credit_xor"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entry_lines"
        ADD CONSTRAINT "chk_jel_debit_credit_xor"
        CHECK (
          debit >= 0
          AND credit >= 0
          AND (
            (debit > 0 AND credit = 0)
            OR (debit = 0 AND credit > 0)
          )
        )
    `);

    // 2a. reversal_of_id -> journal_entries(id)
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        DROP CONSTRAINT IF EXISTS "fk_je_reversal_of"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        ADD CONSTRAINT "fk_je_reversal_of"
        FOREIGN KEY ("reversal_of_id")
        REFERENCES "journal_entries"("id")
        ON DELETE RESTRICT
    `);

    // 2b. reversed_by_id -> users(id)
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        DROP CONSTRAINT IF EXISTS "fk_je_reversed_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        ADD CONSTRAINT "fk_je_reversed_by"
        FOREIGN KEY ("reversed_by_id")
        REFERENCES "users"("id")
        ON DELETE SET NULL
    `);

    // 3. no reversal of a reversal
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        DROP CONSTRAINT IF EXISTS "chk_je_no_reversal_of_reversal"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        ADD CONSTRAINT "chk_je_no_reversal_of_reversal"
        CHECK (NOT (is_reversal = true AND is_reversed = true))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        DROP CONSTRAINT IF EXISTS "chk_je_no_reversal_of_reversal"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        DROP CONSTRAINT IF EXISTS "fk_je_reversed_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entries"
        DROP CONSTRAINT IF EXISTS "fk_je_reversal_of"
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entry_lines"
        DROP CONSTRAINT IF EXISTS "chk_jel_debit_credit_xor"
    `);
  }
}
