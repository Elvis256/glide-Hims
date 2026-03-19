import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixHrEntityMissingColumns1774500400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // TrainingProgram extends BaseEntity which has deleted_at, but table was missing it
    await queryRunner.query(`
      ALTER TABLE "training_programs"
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamp
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "training_programs"
      DROP COLUMN IF EXISTS "deleted_at"
    `);
  }
}
