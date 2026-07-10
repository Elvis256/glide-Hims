import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaasSubscriptionBillingCurrency1782900000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saas_subscriptions" ADD COLUMN IF NOT EXISTS "billing_currency" VARCHAR(3) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saas_subscriptions" DROP COLUMN IF EXISTS "billing_currency"`,
    );
  }
}
