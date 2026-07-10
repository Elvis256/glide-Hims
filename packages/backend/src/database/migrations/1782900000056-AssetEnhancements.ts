import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssetEnhancements1782900000056 implements MigrationInterface {
  name = 'AssetEnhancements1782900000056';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Composite index on fixed_assets(facility_id, status) — asset listing, depreciation queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_asset_facility_status" ON fixed_assets (facility_id, status)`,
    );

    // 2. Composite index on fixed_assets(facility_id, category_id) — category-based filtering
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_asset_facility_category" ON fixed_assets (facility_id, category_id)`,
    );

    // 3. Composite index on asset_transfers(asset_id, status) — open transfer checks
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transfer_asset_status" ON asset_transfers (asset_id, status)`,
    );

    // 4. Composite index on asset_disposals(asset_id, status) — open disposal checks
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disposal_asset_status" ON asset_disposals (asset_id, status)`,
    );

    // 5. Composite index on asset_allocations(asset_id, status) — open allocation checks
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_allocation_asset_status" ON asset_allocations (asset_id, status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_allocation_asset_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disposal_asset_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transfer_asset_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_facility_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_facility_status"`);
  }
}
