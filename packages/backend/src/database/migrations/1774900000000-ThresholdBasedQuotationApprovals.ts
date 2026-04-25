import { MigrationInterface, QueryRunner } from 'typeorm';

export class ThresholdBasedQuotationApprovals1774900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum values
    await queryRunner.query(
      `ALTER TYPE "quotation_approvals_level_enum" ADD VALUE IF NOT EXISTS 'approval_1'`,
    );
    await queryRunner.query(
      `ALTER TYPE "quotation_approvals_level_enum" ADD VALUE IF NOT EXISTS 'approval_2'`,
    );
    await queryRunner.query(
      `ALTER TYPE "quotation_approvals_level_enum" ADD VALUE IF NOT EXISTS 'approval_3'`,
    );

    // Migrate existing data: map old levels to new (cast to text so it's safe even if old enum values don't exist)
    await queryRunner.query(
      `UPDATE quotation_approvals SET level = 'approval_1' WHERE level::text = 'manager'`,
    );
    await queryRunner.query(
      `UPDATE quotation_approvals SET level = 'approval_2' WHERE level::text = 'finance'`,
    );
    await queryRunner.query(
      `UPDATE quotation_approvals SET level = 'approval_3' WHERE level::text = 'director'`,
    );

    // Add new columns
    await queryRunner.query(
      `ALTER TABLE "quotation_approvals" ADD COLUMN IF NOT EXISTS "self_approved" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_approvals" ADD COLUMN IF NOT EXISTS "justification" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert data mapping
    await queryRunner.query(
      `UPDATE quotation_approvals SET level = 'manager' WHERE level = 'approval_1'`,
    );
    await queryRunner.query(
      `UPDATE quotation_approvals SET level = 'finance' WHERE level = 'approval_2'`,
    );
    await queryRunner.query(
      `UPDATE quotation_approvals SET level = 'director' WHERE level = 'approval_3'`,
    );

    // Drop added columns
    await queryRunner.query(
      `ALTER TABLE "quotation_approvals" DROP COLUMN IF EXISTS "justification"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_approvals" DROP COLUMN IF EXISTS "self_approved"`,
    );
  }
}
