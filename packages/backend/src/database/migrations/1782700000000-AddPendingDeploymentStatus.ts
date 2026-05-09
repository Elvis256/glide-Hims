import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingDeploymentStatus1782700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "deployments_status_enum" ADD VALUE IF NOT EXISTS 'pending'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing enum values without recreating the type.
    // Leaving 'pending' in place is harmless on a downgrade.
  }
}
