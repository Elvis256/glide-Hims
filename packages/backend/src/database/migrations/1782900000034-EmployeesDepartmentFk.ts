import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Promote `employees.department` from free-text to a real FK on
 * `departments.id`.
 *
 * We do not drop the legacy text column in this migration — readers
 * across HR, payroll and reports still reference it. The text column
 * stays in place as a deprecated mirror; the entity and service layer
 * dual-write so both columns stay in sync. A follow-up migration can
 * drop the text column once all readers are switched over and a full
 * release has shipped.
 *
 * Backfill strategy:
 *   - For each employee with a non-empty text `department`, try to find
 *     a row in `departments` within the same tenant whose `name` matches
 *     case-insensitively. If found, set `department_id`.
 *   - Unmatched rows are left with `department_id = NULL`; the text is
 *     preserved so HR can later create/rename a department and re-run
 *     the linker.
 */
export class EmployeesDepartmentFk1782900000034 implements MigrationInterface {
  name = 'EmployeesDepartmentFk1782900000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add the column (nullable, no default).
    await queryRunner.query(`
      ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS department_id uuid NULL;
    `);

    // 2) FK to departments with SET NULL on delete so killing a
    // department doesn't cascade-orphan its employees.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_employees_department'
        ) THEN
          ALTER TABLE employees
          ADD CONSTRAINT fk_employees_department
          FOREIGN KEY (department_id)
          REFERENCES departments(id)
          ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    // 3) Index for filter/join performance.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_department_id
      ON employees(department_id);
    `);

    // 4) Backfill: tenant-scoped case-insensitive name match. We only
    // touch rows where department_id is still NULL.
    await queryRunner.query(`
      UPDATE employees e
      SET department_id = d.id
      FROM departments d
      WHERE e.department_id IS NULL
        AND e.department IS NOT NULL
        AND e.department <> ''
        AND lower(trim(d.name)) = lower(trim(e.department))
        AND (
          (e.tenant_id IS NOT NULL AND d.tenant_id = e.tenant_id)
          OR (e.tenant_id IS NULL AND d.tenant_id IS NULL)
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_employees_department_id;`);
    await queryRunner.query(`
      ALTER TABLE employees
      DROP CONSTRAINT IF EXISTS fk_employees_department;
    `);
    await queryRunner.query(`
      ALTER TABLE employees DROP COLUMN IF EXISTS department_id;
    `);
  }
}
