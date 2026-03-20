import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPricingEngine1774600000000 implements MigrationInterface {
  name = 'AddPricingEngine1774600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add retail/wholesale pricing and classification to items
    await queryRunner.query(`
      ALTER TABLE items
        ADD COLUMN IF NOT EXISTS retail_price DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) NOT NULL DEFAULT 'standard'
    `);

    // 2. Add default markup percentages to item_categories
    await queryRunner.query(`
      ALTER TABLE item_categories
        ADD COLUMN IF NOT EXISTS default_retail_markup DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS default_wholesale_markup DECIMAL(5,2)
    `);

    // 3. Add retail/wholesale prices to goods_receipt_items
    await queryRunner.query(`
      ALTER TABLE goods_receipt_items
        ADD COLUMN IF NOT EXISTS retail_price DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(10,2)
    `);

    // 4. Index for quick lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_items_is_sellable ON items (is_sellable) WHERE is_sellable = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_items_item_type ON items (item_type)
    `);

    // 5. Backfill: set retail_price = selling_price for existing items that have a selling price
    await queryRunner.query(`
      UPDATE items SET retail_price = selling_price WHERE selling_price > 0 AND retail_price IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_items_item_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_items_is_sellable`);
    await queryRunner.query(`
      ALTER TABLE goods_receipt_items
        DROP COLUMN IF EXISTS retail_price,
        DROP COLUMN IF EXISTS wholesale_price
    `);
    await queryRunner.query(`
      ALTER TABLE item_categories
        DROP COLUMN IF EXISTS default_retail_markup,
        DROP COLUMN IF EXISTS default_wholesale_markup
    `);
    await queryRunner.query(`
      ALTER TABLE items
        DROP COLUMN IF EXISTS retail_price,
        DROP COLUMN IF EXISTS wholesale_price,
        DROP COLUMN IF EXISTS is_sellable,
        DROP COLUMN IF EXISTS item_type
    `);
  }
}
