import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Who rejected, completed or cancelled a referral.
 *
 * Accepting a referral recorded both the user and the time. The other three
 * dispositions recorded neither: rejection stored only a reason, completion
 * only a timestamp, cancellation only a reason. Turning a referred patient
 * away is a clinical decision with consequences for the referring unit, and
 * nothing in the record said who made it.
 */
export class ReferralDispositionAttribution1782900000095 implements MigrationInterface {
  name = 'ReferralDispositionAttribution1782900000095';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "referrals"
      ADD COLUMN IF NOT EXISTS "rejected_by_id" uuid,
      ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "completed_by_id" uuid,
      ADD COLUMN IF NOT EXISTS "cancelled_by_id" uuid,
      ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP WITH TIME ZONE
    `);

    for (const [column, constraint] of [
      ['rejected_by_id', 'fk_referrals_rejected_by'],
      ['completed_by_id', 'fk_referrals_completed_by'],
      ['cancelled_by_id', 'fk_referrals_cancelled_by'],
    ]) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraint}') THEN
            ALTER TABLE "referrals"
            ADD CONSTRAINT "${constraint}"
            FOREIGN KEY ("${column}") REFERENCES "users"("id") ON DELETE SET NULL;
          END IF;
        END
        $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "referrals"
      DROP COLUMN IF EXISTS "rejected_by_id",
      DROP COLUMN IF EXISTS "rejected_at",
      DROP COLUMN IF EXISTS "completed_by_id",
      DROP COLUMN IF EXISTS "cancelled_by_id",
      DROP COLUMN IF EXISTS "cancelled_at"
    `);
  }
}
