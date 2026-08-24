import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Who cancelled a critical-result alert, and when.
 *
 * Cancelling is the "the result was amended away, stand down" path: it closes
 * an alert about a life-threatening value without anybody acknowledging that
 * the patient was reviewed. Flagging recorded a user, acknowledging recorded a
 * user, escalating recorded the recipients — cancelling recorded nothing at
 * all, not on the row and not in the audit log, whose user_id came through
 * empty. The one disposition that ends an alert without clinical review was
 * the one nobody's name was against.
 */
export class CriticalResultCancellationAttribution1782900000096 implements MigrationInterface {
  name = 'CriticalResultCancellationAttribution1782900000096';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "critical_result_alerts"
      ADD COLUMN IF NOT EXISTS "cancelled_by_id" uuid,
      ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "cancellation_reason" text
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_critical_result_alerts_cancelled_by') THEN
          ALTER TABLE "critical_result_alerts"
          ADD CONSTRAINT "fk_critical_result_alerts_cancelled_by"
          FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "critical_result_alerts"
      DROP CONSTRAINT IF EXISTS "fk_critical_result_alerts_cancelled_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "critical_result_alerts"
      DROP COLUMN IF EXISTS "cancellation_reason",
      DROP COLUMN IF EXISTS "cancelled_at",
      DROP COLUMN IF EXISTS "cancelled_by_id"
    `);
  }
}
