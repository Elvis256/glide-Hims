import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * admissions.encounterId NOT NULL contradicted the DTO/service, where the
 * encounter has always been optional (direct admissions / external
 * referrals have no prior encounter) — every such admission 500'd on the
 * not-null constraint. Found by E2E testing.
 */
export class AdmissionEncounterNullable1782900000076 implements MigrationInterface {
  name = 'AdmissionEncounterNullable1782900000076';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admissions" ALTER COLUMN "encounterId" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only restorable if no NULL rows exist
    await queryRunner.query(
      `ALTER TABLE "admissions" ALTER COLUMN "encounterId" SET NOT NULL`,
    );
  }
}
