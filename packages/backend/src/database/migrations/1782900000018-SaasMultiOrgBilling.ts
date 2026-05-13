import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaasMultiOrgBilling1782900000018 implements MigrationInterface {
  name = 'SaasMultiOrgBilling1782900000018';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE saas_subscriptions ADD COLUMN IF NOT EXISTS billing_payer_tenant_id UUID;`);
    await q.query(`CREATE INDEX IF NOT EXISTS ix_saas_subscriptions_payer ON saas_subscriptions(billing_payer_tenant_id);`);

    await q.query(`ALTER TABLE saas_invoices ADD COLUMN IF NOT EXISTS billing_payer_tenant_id UUID;`);
    await q.query(`CREATE INDEX IF NOT EXISTS ix_saas_invoices_payer ON saas_invoices(billing_payer_tenant_id);`);

    await q.query(`ALTER TABLE saas_payments ADD COLUMN IF NOT EXISTS billing_payer_tenant_id UUID;`);
    await q.query(`CREATE INDEX IF NOT EXISTS ix_saas_payments_payer ON saas_payments(billing_payer_tenant_id);`);

    // Backfill: existing subscriptions/invoices/payments have no payer (NULL = self-pays).
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS ix_saas_payments_payer;`);
    await q.query(`ALTER TABLE saas_payments DROP COLUMN IF EXISTS billing_payer_tenant_id;`);
    await q.query(`DROP INDEX IF EXISTS ix_saas_invoices_payer;`);
    await q.query(`ALTER TABLE saas_invoices DROP COLUMN IF EXISTS billing_payer_tenant_id;`);
    await q.query(`DROP INDEX IF EXISTS ix_saas_subscriptions_payer;`);
    await q.query(`ALTER TABLE saas_subscriptions DROP COLUMN IF EXISTS billing_payer_tenant_id;`);
  }
}
