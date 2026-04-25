import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddItemIdToInsurancePriceList1774951000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE insurance_price_lists
      ADD COLUMN IF NOT EXISTS item_id UUID
    `);

    await queryRunner.query(`
      ALTER TABLE insurance_price_lists
      ADD CONSTRAINT fk_insurance_price_list_item
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ipl_provider_item
      ON insurance_price_lists (insurance_provider_id, item_id)
      WHERE item_id IS NOT NULL AND is_active = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ipl_provider_item`);
    await queryRunner.query(
      `ALTER TABLE insurance_price_lists DROP CONSTRAINT IF EXISTS fk_insurance_price_list_item`,
    );
    await queryRunner.query(`ALTER TABLE insurance_price_lists DROP COLUMN IF EXISTS item_id`);
  }
}
