import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixAppraisalForeignKeys1774500100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old FKs referencing employees table
    const fks = await queryRunner.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'performance_appraisals'::regclass
        AND contype = 'f'
        AND confrelid = 'employees'::regclass
    `);

    for (const fk of fks) {
      await queryRunner.query(
        `ALTER TABLE "performance_appraisals" DROP CONSTRAINT "${fk.conname}"`,
      );
    }

    // Add new FKs referencing users table
    await queryRunner.query(`
      ALTER TABLE "performance_appraisals"
      ADD CONSTRAINT "FK_appraisal_employee_user"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "performance_appraisals"
      ADD CONSTRAINT "FK_appraisal_reviewer_user"
      FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "performance_appraisals" DROP CONSTRAINT IF EXISTS "FK_appraisal_employee_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "performance_appraisals" DROP CONSTRAINT IF EXISTS "FK_appraisal_reviewer_user"`,
    );

    await queryRunner.query(`
      ALTER TABLE "performance_appraisals"
      ADD CONSTRAINT "FK_appraisal_employee"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    `);
    await queryRunner.query(`
      ALTER TABLE "performance_appraisals"
      ADD CONSTRAINT "FK_appraisal_reviewer"
      FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id")
    `);
  }
}
