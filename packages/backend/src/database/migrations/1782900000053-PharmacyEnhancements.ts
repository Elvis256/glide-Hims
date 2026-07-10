import { MigrationInterface, QueryRunner } from 'typeorm';

export class PharmacyEnhancements1782900000053 implements MigrationInterface {
  name = 'PharmacyEnhancements1782900000053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add witness_name column to controlled_substance_logs
    await queryRunner.query(
      `ALTER TABLE controlled_substance_logs ADD COLUMN IF NOT EXISTS "witness_name" VARCHAR(255) NULL`,
    );

    // 2. Composite index on controlled_substance_logs(facility_id, drug_schedule)
    //    — controlled register queries filter by facility + schedule
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ctrl_logs_facility_drug_schedule" ON controlled_substance_logs (facility_id, drug_schedule)`,
    );

    // 3. Composite index on batch_stock_balances(facility_id, status, expiry_date)
    //    — expiry processing, quarantine queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_batch_stock_facility_status_expiry" ON batch_stock_balances (facility_id, status, expiry_date)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_batch_stock_facility_status_expiry"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ctrl_logs_facility_drug_schedule"`);
    await queryRunner.query(
      `ALTER TABLE controlled_substance_logs DROP COLUMN IF EXISTS "witness_name"`,
    );
  }
}
