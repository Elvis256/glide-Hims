import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeploymentPollRequest1782900000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "poll_requested_at" TIMESTAMP NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deployments" DROP COLUMN IF EXISTS "poll_requested_at"`);
  }
}
