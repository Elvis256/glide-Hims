import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P0 — offline sale idempotency hardening.
 *
 * The pharmacy POS allows clients to dispense offline and assign a
 * `clientSaleId` UUID that is later sent up on sync. PharmacyService.createSale
 * already does a pre-INSERT existence check on `(tenantId, clientSaleId)` and
 * returns the existing sale if found, but two concurrent sync requests for the
 * same offline sale can BOTH pass the existence check and then BOTH insert,
 * producing duplicate pharmacy_sales rows that double-deduct stock and double
 * record revenue.
 *
 * A partial unique index on `(tenant_id, client_sale_id) WHERE client_sale_id
 * IS NOT NULL` lets the database refuse the second insert with a unique
 * violation (SQLSTATE 23505); the service catches that and returns the
 * winning row instead. The index is partial so it does not constrain the
 * (very large) population of normal in-house sales that never carry a
 * clientSaleId.
 *
 * If duplicates already exist in production data, the index creation will
 * fail. The migration first DELETEs duplicates keeping the oldest row so
 * the new constraint can be safely applied; downstream stock/ledger rows
 * created by the duplicates remain (deleting those would risk inventory
 * skew). Operators should reconcile any pharmacy_sale_items / stock_ledger
 * rows that reference deleted sale ids via a follow-up reconciliation job.
 */
export class PharmacySaleClientIdUnique1782900000035 implements MigrationInterface {
  name = 'PharmacySaleClientIdUnique1782900000035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop duplicates first (keep the earliest row per tenant+clientSaleId).
    await queryRunner.query(`
      DELETE FROM pharmacy_sales s
      USING pharmacy_sales s2
      WHERE s.client_sale_id IS NOT NULL
        AND s.client_sale_id = s2.client_sale_id
        AND COALESCE(s.tenant_id::text, '') = COALESCE(s2.tenant_id::text, '')
        AND s.created_at > s2.created_at;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS pharmacy_sales_tenant_client_sale_uniq
      ON pharmacy_sales (tenant_id, client_sale_id)
      WHERE client_sale_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS pharmacy_sales_tenant_client_sale_uniq;`);
  }
}
