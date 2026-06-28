import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuotationDeploymentFields1782900000047 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE saas_quotations
        ADD COLUMN IF NOT EXISTS deployment_type varchar(20),
        ADD COLUMN IF NOT EXISTS deployment_domain varchar(255),
        ADD COLUMN IF NOT EXISTS deployment_id uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE saas_quotations
        DROP COLUMN IF EXISTS deployment_id,
        DROP COLUMN IF EXISTS deployment_domain,
        DROP COLUMN IF EXISTS deployment_type
    `);
  }
}
