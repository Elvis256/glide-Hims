import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persists the billing mode (`pre_pay` | `post_pay`) chosen at OPD-token
 * issue time on the encounter row so downstream gates (e.g. doctor
 * Sign & Complete) can decide whether an unpaid invoice is a hard block
 * or expected (post-pay = settle at checkout).
 *
 * Backfilled to 'post_pay' (the system default) for historical encounters.
 */
export class EncounterBillingMode1782900000026 implements MigrationInterface {
  name = 'EncounterBillingMode1782900000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Use TEXT (not enum) to keep migrations cheap; values constrained by app code.
    await queryRunner.query(`
      ALTER TABLE "encounters"
      ADD COLUMN IF NOT EXISTS "billing_mode" varchar(16) NOT NULL DEFAULT 'post_pay'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_encounters_billing_mode"
      ON "encounters" ("billing_mode")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_encounters_billing_mode"`);
    await queryRunner.query(`ALTER TABLE "encounters" DROP COLUMN IF EXISTS "billing_mode"`);
  }
}
