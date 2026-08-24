import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `employees.insurance_coverage` — the column both halves of the staff
 * insurance feature have always read and written, and which has never existed.
 *
 * GET /biometrics/staff-coverage/:userId selects e.insurance_coverage and
 * POST writes it back; the table has no such column, so both answered
 * "column e.insurance_coverage does not exist" as a 500. Staff medical cover
 * could not be recorded or looked up at all — found by sweeping every
 * parameterised GET.
 *
 * jsonb, because the service stores a whole object there: enabled, provider,
 * policyNumber, planType, validFrom, validUntil, coverageLimit, usedAmount.
 */
export class EmployeeInsuranceCoverage1782900000097 implements MigrationInterface {
  name = 'EmployeeInsuranceCoverage1782900000097';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      ADD COLUMN IF NOT EXISTS "insurance_coverage" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees" DROP COLUMN IF EXISTS "insurance_coverage"
    `);
  }
}
