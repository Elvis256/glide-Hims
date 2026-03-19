import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPayrollToUseUsers1774500300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add allowances and deductions JSONB columns to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "allowances" jsonb,
      ADD COLUMN IF NOT EXISTS "deductions" jsonb
    `);

    // 2. Drop the existing FK on payslips.employee_id → employees
    await queryRunner.query(`
      ALTER TABLE "payslips"
      DROP CONSTRAINT IF EXISTS "FK_3ca6cde51127cd649278d038ca9"
    `);

    // 3. Add new FK on payslips.employee_id → users
    await queryRunner.query(`
      ALTER TABLE "payslips"
      ADD CONSTRAINT "FK_payslips_user_id" FOREIGN KEY ("employee_id")
      REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // 4. Delete any existing payslips with employee_ids that don't match users
    // (cleanup from previous 0-amount payroll runs)
    await queryRunner.query(`
      DELETE FROM "payslips" WHERE "employee_id" NOT IN (SELECT id FROM "users")
    `);

    // 5. Reset any completed payroll runs that have 0 totals (allow re-processing)
    await queryRunner.query(`
      UPDATE "payroll_runs" SET status = 'draft', employee_count = 0,
        total_gross = 0, total_deductions = 0, total_net = 0, total_paye = 0, total_nssf = 0
      WHERE status = 'completed' AND total_gross = 0 AND total_net = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore FK to employees
    await queryRunner.query(`
      ALTER TABLE "payslips"
      DROP CONSTRAINT IF EXISTS "FK_payslips_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "payslips"
      ADD CONSTRAINT "FK_3ca6cde51127cd649278d038ca9" FOREIGN KEY ("employee_id")
      REFERENCES "employees"("id") ON DELETE SET NULL
    `);
    // Drop new columns from users
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "allowances",
      DROP COLUMN IF EXISTS "deductions"
    `);
  }
}
