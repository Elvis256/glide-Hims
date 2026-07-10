import { MigrationInterface, QueryRunner } from 'typeorm';

export class LabEnhancements1782900000052 implements MigrationInterface {
  name = 'LabEnhancements1782900000052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Composite index on lab_samples(order_id, lab_test_id) — duplicate check in collectSample
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lab_samples_order_id_lab_test_id" ON lab_samples ("orderId", "labTestId")`,
    );

    // 2. Composite index on lab_samples(facility_id, status, created_at) — getSampleQueue, dashboard counts
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lab_samples_facility_status_created" ON lab_samples ("facilityId", status, created_at)`,
    );

    // 3. Composite index on lab_samples(facility_id, collection_time) — getTurnaroundStats date range
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lab_samples_facility_collection_time" ON lab_samples ("facilityId", "collectionTime")`,
    );

    // 4. Composite index on qc_results(qc_material_id, facility_id) — previousResults lookup in recordQCResult
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_qc_results_material_facility" ON qc_results (qc_material_id, facility_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qc_results_material_facility"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lab_samples_facility_collection_time"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lab_samples_facility_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lab_samples_order_id_lab_test_id"`);
  }
}
