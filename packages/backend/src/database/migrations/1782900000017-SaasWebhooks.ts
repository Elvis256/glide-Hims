import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaasWebhooks1782900000017 implements MigrationInterface {
  name = 'SaasWebhooks1782900000017';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS saas_webhook_endpoints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        url TEXT NOT NULL,
        secret TEXT NOT NULL,
        events TEXT[] NOT NULL DEFAULT '{}',
        description TEXT,
        enabled BOOLEAN NOT NULL DEFAULT true,
        consecutive_failures INT NOT NULL DEFAULT 0,
        last_success_at TIMESTAMPTZ,
        last_failure_at TIMESTAMPTZ,
        disabled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS ix_saas_webhook_endpoints_tenant ON saas_webhook_endpoints(tenant_id);`,
    );
    await q.query(`
      CREATE TABLE IF NOT EXISTS saas_webhook_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint_id UUID NOT NULL REFERENCES saas_webhook_endpoints(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        event_id UUID NOT NULL DEFAULT gen_random_uuid(),
        payload JSONB NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        response_code INT,
        response_body TEXT,
        error_message TEXT,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_attempt_at TIMESTAMPTZ,
        succeeded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS ix_saas_webhook_deliveries_status_next ON saas_webhook_deliveries(status, next_attempt_at);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS ix_saas_webhook_deliveries_tenant ON saas_webhook_deliveries(tenant_id);`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS ix_saas_webhook_deliveries_endpoint ON saas_webhook_deliveries(endpoint_id);`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS saas_webhook_deliveries;`);
    await q.query(`DROP TABLE IF EXISTS saas_webhook_endpoints;`);
  }
}
