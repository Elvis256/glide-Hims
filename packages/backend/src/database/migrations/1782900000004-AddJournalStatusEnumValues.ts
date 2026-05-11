import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint-5: align journal_entries.status enum with the application enum.
 *
 * Sprint-1 introduced the multi-level approval workflow which uses
 * `submitted`, `approved`, and `rejected` statuses, but the database
 * enum was never extended — so every submitForApproval / approve /
 * reject call was failing at runtime with:
 *   invalid input value for enum journal_entries_status_enum
 *
 * This migration adds the three missing values. Postgres enum values
 * cannot be removed in a transactional way, so the down migration is
 * a no-op.
 */
export class AddJournalStatusEnumValues1782900000004
  implements MigrationInterface
{
  name = 'AddJournalStatusEnumValues1782900000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "journal_entries_status_enum" ADD VALUE IF NOT EXISTS 'submitted'`,
    );
    await queryRunner.query(
      `ALTER TYPE "journal_entries_status_enum" ADD VALUE IF NOT EXISTS 'approved'`,
    );
    await queryRunner.query(
      `ALTER TYPE "journal_entries_status_enum" ADD VALUE IF NOT EXISTS 'rejected'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres cannot remove enum values without rebuilding the type
    // and rewriting every row. Intentional no-op.
  }
}
