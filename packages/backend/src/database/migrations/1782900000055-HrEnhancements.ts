import { MigrationInterface, QueryRunner } from 'typeorm';

export class HrEnhancements1782900000055 implements MigrationInterface {
  name = 'HrEnhancements1782900000055';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Composite index on leave_requests(employee_id, status) — balance checks, leave queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_leave_employee_status" ON leave_requests (employee_id, status)`,
    );

    // 2. Composite index on leave_requests(employee_id, start_date) — overlap detection
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_leave_employee_start" ON leave_requests (employee_id, start_date)`,
    );

    // 3. Composite index on attendance_records(employee_id, date) — attendance lookups
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_attendance_employee_date" ON attendance_records (employee_id, date)`,
    );

    // 4. Composite index on attendance_records(facility_id, date) — daily facility reports
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_attendance_facility_date" ON attendance_records (facility_id, date)`,
    );

    // 5. Composite index on payroll_runs(facility_id, month, year) — duplicate check
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payroll_facility_month_year" ON payroll_runs (facility_id, month, year)`,
    );

    // 6. Composite index on employees(facility_id, status) — staff queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employee_facility_status" ON employees (facility_id, status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_employee_facility_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payroll_facility_month_year"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attendance_facility_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attendance_employee_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_leave_employee_start"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_leave_employee_status"`);
  }
}
