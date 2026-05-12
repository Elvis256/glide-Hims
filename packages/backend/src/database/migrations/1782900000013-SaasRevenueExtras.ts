import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaasRevenueExtras1782900000013 implements MigrationInterface {
  name = 'SaasRevenueExtras1782900000013';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE saas_invoices ADD COLUMN IF NOT EXISTS fx_rate_to_base numeric(18,6) NOT NULL DEFAULT 1`);
    await q.query(`ALTER TABLE saas_payments ADD COLUMN IF NOT EXISTS fx_rate_to_base numeric(18,6) NOT NULL DEFAULT 1`);
    await q.query(`ALTER TABLE saas_subscriptions ADD COLUMN IF NOT EXISTS billing_email varchar(255)`);
    await q.query(`ALTER TABLE saas_subscriptions ADD COLUMN IF NOT EXISTS billing_name varchar(255)`);
    await q.query(`ALTER TABLE saas_payments ADD COLUMN IF NOT EXISTS gateway_payload jsonb`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE saas_payments DROP COLUMN IF EXISTS gateway_payload`);
    await q.query(`ALTER TABLE saas_subscriptions DROP COLUMN IF EXISTS billing_name`);
    await q.query(`ALTER TABLE saas_subscriptions DROP COLUMN IF EXISTS billing_email`);
    await q.query(`ALTER TABLE saas_payments DROP COLUMN IF EXISTS fx_rate_to_base`);
    await q.query(`ALTER TABLE saas_invoices DROP COLUMN IF EXISTS fx_rate_to_base`);
  }
}
