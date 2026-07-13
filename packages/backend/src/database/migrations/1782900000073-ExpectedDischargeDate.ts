import { MigrationInterface, QueryRunner } from 'typeorm';

/** Planned discharge date on admissions for the discharge-planning board. */
export class ExpectedDischargeDate1782900000073 implements MigrationInterface {
  name = 'ExpectedDischargeDate1782900000073';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admissions" ADD COLUMN IF NOT EXISTS "expected_discharge_date" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admissions" DROP COLUMN IF EXISTS "expected_discharge_date"`,
    );
  }
}
