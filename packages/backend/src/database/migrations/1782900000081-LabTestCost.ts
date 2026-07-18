import { MigrationInterface, QueryRunner } from 'typeorm';

/** lab_tests.cost — unit cost of running the test, for margin reporting on the
 *  admin test catalogue. Nullable: null = "not costed", distinct from 0. */
export class LabTestCost1782900000081 implements MigrationInterface {
  name = 'LabTestCost1782900000081';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lab_tests" ADD COLUMN IF NOT EXISTS "cost" numeric(10,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lab_tests" DROP COLUMN IF EXISTS "cost"`);
  }
}
