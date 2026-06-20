import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaasBillingP01782900000045 implements MigrationInterface {
  name = 'SaasBillingP01782900000045';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saas_subscriptions" ADD COLUMN IF NOT EXISTS "couponAppliedAt" timestamptz`,
    );

    // Backfill: set couponAppliedAt = createdAt for existing subscriptions that have a coupon
    await queryRunner.query(
      `UPDATE "saas_subscriptions" SET "couponAppliedAt" = "createdAt" WHERE "couponId" IS NOT NULL AND "couponAppliedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saas_subscriptions" DROP COLUMN IF EXISTS "couponAppliedAt"`,
    );
  }
}
