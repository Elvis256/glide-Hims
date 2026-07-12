import { MigrationInterface, QueryRunner } from 'typeorm';

/** Dedup marker for the daily EPI defaulter SMS reminder cron. */
export class EpiDefaulterReminders1782900000071 implements MigrationInterface {
  name = 'EpiDefaulterReminders1782900000071';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "immunization_schedules"
         ADD COLUMN IF NOT EXISTS "last_defaulter_reminder_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "immunization_schedules" DROP COLUMN IF EXISTS "last_defaulter_reminder_at"`,
    );
  }
}
