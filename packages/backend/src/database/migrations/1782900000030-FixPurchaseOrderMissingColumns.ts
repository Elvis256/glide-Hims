import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The PurchaseOrder entity declares cost_center_id, department_id and
 * emergency_justification but no migration ever created them. As a result,
 * EVERY query against purchase_orders (including the GRN list endpoint that
 * joins to it) returns HTTP 500 with `column purchaseOrder.emergency_justification
 * does not exist`. Adds the missing columns plus indexes for the FKs that are
 * realistically used in WHERE/JOIN.
 */
export class FixPurchaseOrderMissingColumns1782900000030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purchase_orders"
        ADD COLUMN IF NOT EXISTS "department_id"           uuid,
        ADD COLUMN IF NOT EXISTS "cost_center_id"          uuid,
        ADD COLUMN IF NOT EXISTS "emergency_justification" text
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_purchase_orders_department_id"
        ON "purchase_orders" ("department_id")
        WHERE "department_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_purchase_orders_cost_center_id"
        ON "purchase_orders" ("cost_center_id")
        WHERE "cost_center_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_purchase_orders_department_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_purchase_orders_cost_center_id"`);
    await queryRunner.query(`
      ALTER TABLE "purchase_orders"
        DROP COLUMN IF EXISTS "emergency_justification",
        DROP COLUMN IF EXISTS "cost_center_id",
        DROP COLUMN IF EXISTS "department_id"
    `);
  }
}
