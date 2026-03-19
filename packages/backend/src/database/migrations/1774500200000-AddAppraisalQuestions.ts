import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppraisalQuestions1774500200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "performance_appraisals"
      ADD COLUMN IF NOT EXISTS "questions" jsonb,
      ADD COLUMN IF NOT EXISTS "employee_answers" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "performance_appraisals"
      DROP COLUMN IF EXISTS "questions",
      DROP COLUMN IF EXISTS "employee_answers"
    `);
  }
}
