import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProcurementEnhancements1782900000054 implements MigrationInterface {
  name = 'ProcurementEnhancements1782900000054';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Composite index on purchase_requests(facility_id, status)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pr_facility_status" ON purchase_requests (facility_id, status)`,
    );

    // 2. Composite index on purchase_orders(facility_id, status)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_po_facility_status" ON purchase_orders (facility_id, status)`,
    );

    // 3. Composite index on purchase_orders(supplier_id, status)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_po_supplier_status" ON purchase_orders (supplier_id, status)`,
    );

    // 4. Composite index on goods_receipt_notes(facility_id, status)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grn_facility_status" ON goods_receipt_notes (facility_id, status)`,
    );

    // 5. Index on goods_receipt_notes(purchase_order_id) — GRN-to-PO lookup for tracing
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_grn_purchase_order" ON goods_receipt_notes (purchase_order_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grn_purchase_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_grn_facility_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_po_supplier_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_po_facility_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pr_facility_status"`);
  }
}
