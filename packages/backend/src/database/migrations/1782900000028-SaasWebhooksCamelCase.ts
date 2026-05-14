import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rename snake_case columns on saas_webhook_endpoints / saas_webhook_deliveries
 * to camelCase so they match the TypeORM entity property names. The original
 * migration (1782900000017-SaasWebhooks) used snake_case, which caused the
 * WebhookDispatcherService cron to fail every minute with
 *   `column SaasWebhookDelivery.endpointId does not exist`.
 *
 * Idempotent: skips renames if the target column is already present.
 */
export class SaasWebhooksCamelCase1782900000028 implements MigrationInterface {
  name = 'SaasWebhooksCamelCase1782900000028';

  private async renameIfExists(
    q: QueryRunner,
    table: string,
    from: string,
    to: string,
  ): Promise<void> {
    const rows: Array<{ column_name: string }> = await q.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = $1 AND column_name IN ($2, $3)`,
      [table, from, to],
    );
    const have = new Set(rows.map((r) => r.column_name));
    if (have.has(to)) return;
    if (!have.has(from)) return;
    await q.query(`ALTER TABLE ${table} RENAME COLUMN "${from}" TO "${to}"`);
  }

  public async up(q: QueryRunner): Promise<void> {
    const endpointRenames: Array<[string, string]> = [
      ['tenant_id', 'tenantId'],
      ['consecutive_failures', 'consecutiveFailures'],
      ['last_success_at', 'lastSuccessAt'],
      ['last_failure_at', 'lastFailureAt'],
      ['disabled_at', 'disabledAt'],
      ['created_at', 'createdAt'],
      ['updated_at', 'updatedAt'],
    ];
    for (const [from, to] of endpointRenames) {
      await this.renameIfExists(q, 'saas_webhook_endpoints', from, to);
    }

    const deliveryRenames: Array<[string, string]> = [
      ['endpoint_id', 'endpointId'],
      ['tenant_id', 'tenantId'],
      ['event_type', 'eventType'],
      ['event_id', 'eventId'],
      ['response_code', 'responseCode'],
      ['response_body', 'responseBody'],
      ['error_message', 'errorMessage'],
      ['next_attempt_at', 'nextAttemptAt'],
      ['last_attempt_at', 'lastAttemptAt'],
      ['succeeded_at', 'succeededAt'],
      ['created_at', 'createdAt'],
    ];
    for (const [from, to] of deliveryRenames) {
      await this.renameIfExists(q, 'saas_webhook_deliveries', from, to);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    const endpointRenames: Array<[string, string]> = [
      ['tenantId', 'tenant_id'],
      ['consecutiveFailures', 'consecutive_failures'],
      ['lastSuccessAt', 'last_success_at'],
      ['lastFailureAt', 'last_failure_at'],
      ['disabledAt', 'disabled_at'],
      ['createdAt', 'created_at'],
      ['updatedAt', 'updated_at'],
    ];
    for (const [from, to] of endpointRenames) {
      await this.renameIfExists(q, 'saas_webhook_endpoints', from, to);
    }

    const deliveryRenames: Array<[string, string]> = [
      ['endpointId', 'endpoint_id'],
      ['tenantId', 'tenant_id'],
      ['eventType', 'event_type'],
      ['eventId', 'event_id'],
      ['responseCode', 'response_code'],
      ['responseBody', 'response_body'],
      ['errorMessage', 'error_message'],
      ['nextAttemptAt', 'next_attempt_at'],
      ['lastAttemptAt', 'last_attempt_at'],
      ['succeededAt', 'succeeded_at'],
      ['createdAt', 'created_at'],
    ];
    for (const [from, to] of deliveryRenames) {
      await this.renameIfExists(q, 'saas_webhook_deliveries', from, to);
    }
  }
}
