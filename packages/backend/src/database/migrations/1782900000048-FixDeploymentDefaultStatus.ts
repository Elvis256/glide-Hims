import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDeploymentDefaultStatus1782900000048 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix deployments marked 'active' that never received a health check —
    // they were never actually verified as running.
    await queryRunner.query(`
      UPDATE deployments
         SET status = 'pending'
       WHERE status = 'active'
         AND last_health_check IS NULL
    `);

    // Change the column default from 'active' to 'pending'
    await queryRunner.query(`
      ALTER TABLE deployments
        ALTER COLUMN status SET DEFAULT 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE deployments
        ALTER COLUMN status SET DEFAULT 'active'
    `);
  }
}
