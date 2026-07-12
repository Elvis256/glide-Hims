import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1. users.leave_last_accrued_month ('YYYY-MM') — the monthly accrual cron
 *    had no idempotency marker, so a re-run (restart at month boundary,
 *    manual trigger) double-accrued leave.
 * 2. Leave balances int → numeric(5,2) — the accrual adds 1.75/0.83 days a
 *    month which integer columns silently truncated.
 */
export class LeaveAccrualIdempotency1782900000069 implements MigrationInterface {
  name = 'LeaveAccrualIdempotency1782900000069';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "leave_last_accrued_month" varchar(7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "annual_leave_balance" TYPE numeric(5,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "sick_leave_balance" TYPE numeric(5,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "leave_last_accrued_month"`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "annual_leave_balance" TYPE integer USING round("annual_leave_balance")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "sick_leave_balance" TYPE integer USING round("sick_leave_balance")`,
    );
  }
}
