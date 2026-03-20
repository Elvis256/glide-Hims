import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuotationToPurchaseOrders1774800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add rfq_id, quotation_id, and created_from columns to purchase_orders
    await queryRunner.query(`
      ALTER TABLE purchase_orders 
        ADD COLUMN IF NOT EXISTS rfq_id UUID REFERENCES rfqs(id),
        ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES vendor_quotations(id),
        ADD COLUMN IF NOT EXISTS created_from VARCHAR(50)
    `);

    // Backfill created_from for existing POs
    await queryRunner.query(`
      UPDATE purchase_orders SET created_from = 'purchase_request' WHERE purchase_request_id IS NOT NULL AND created_from IS NULL
    `);
    await queryRunner.query(`
      UPDATE purchase_orders SET created_from = 'manual' WHERE purchase_request_id IS NULL AND created_from IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders 
        DROP COLUMN IF EXISTS rfq_id,
        DROP COLUMN IF EXISTS quotation_id,
        DROP COLUMN IF EXISTS created_from
    `);
  }
}
