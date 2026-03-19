import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixHrMissingColumns1774400000000 implements MigrationInterface {
  name = 'FixHrMissingColumns1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add deleted_at to leave_requests (entity extends BaseEntity which has @DeleteDateColumn)
    const hasDeletedAt = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'leave_requests' AND column_name = 'deleted_at'
    `);
    if (hasDeletedAt.length === 0) {
      await queryRunner.query(`ALTER TABLE "leave_requests" ADD COLUMN "deleted_at" TIMESTAMP`);
    }

    // Add tenant_id to payslips if missing
    const payslipTenant = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'payslips' AND column_name = 'tenant_id'
    `);
    if (payslipTenant.length === 0) {
      await queryRunner.query(`ALTER TABLE "payslips" ADD COLUMN "tenant_id" UUID`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "payslips" DROP COLUMN IF EXISTS "tenant_id"`);
  }
}
