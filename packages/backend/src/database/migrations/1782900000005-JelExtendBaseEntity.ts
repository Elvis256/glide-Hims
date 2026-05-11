import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint-6: align journal_entry_lines with the rest of the BaseEntity-
 * derived business tables.
 *
 * Until now JEL had only `id`, `tenant_id` and `created_at`. The audit
 * trail had no way to express:
 *   - when a line was last modified (e.g. corrected before posting)
 *   - whether a line was soft-deleted (DRAFT cleanup, line removal
 *     during edit) without losing the historical row.
 *
 * Soft-delete semantics matter because once a journal entry is POSTED,
 * its lines must be immutable. Hard-deleting DRAFT lines that were
 * later replaced loses the maker/checker trail. With `deleted_at`
 * TypeORM's @DeleteDateColumn excludes them from default reads while
 * preserving the audit history.
 *
 * Backfill strategy:
 *   - updated_at defaults to now() and is also backfilled to created_at
 *     so existing history lines retain their original timestamp as both
 *     created_at and updated_at (no spurious "last touched today").
 *   - deleted_at stays NULL on every existing row (none were soft-
 *     deleted before this migration existed).
 */
export class JelExtendBaseEntity1782900000005 implements MigrationInterface {
  name = 'JelExtendBaseEntity1782900000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "journal_entry_lines"
        ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "journal_entry_lines"
        ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL
    `);
    // Backfill updated_at = created_at so historical rows don't appear
    // to have been touched at migration time.
    await queryRunner.query(`
      UPDATE "journal_entry_lines"
         SET "updated_at" = "created_at"
       WHERE "updated_at" >= "created_at"
         AND ("updated_at" - "created_at") < INTERVAL '1 day'
    `);
    // Match the BaseEntity tenant_id index used elsewhere.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journal_entry_lines_tenant_id"
        ON "journal_entry_lines" ("tenant_id")
    `);
    // Partial index helps soft-delete-aware queries skip dead rows.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_journal_entry_lines_deleted_at"
        ON "journal_entry_lines" ("deleted_at")
        WHERE "deleted_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_journal_entry_lines_deleted_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_journal_entry_lines_tenant_id"`);
    await queryRunner.query(`ALTER TABLE "journal_entry_lines" DROP COLUMN IF EXISTS "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "journal_entry_lines" DROP COLUMN IF EXISTS "updated_at"`);
  }
}
