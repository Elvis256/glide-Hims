import { MigrationInterface, QueryRunner } from 'typeorm';

export class MaternityEnhancements1782900000057 implements MigrationInterface {
  name = 'MaternityEnhancements1782900000057';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Composite index on antenatal_registrations(facility_id, status) — listing, dashboard
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_anc_facility_status" ON antenatal_registrations (facility_id, status)`,
    );

    // 2. Composite index on labour_records(facility_id, status) — active labours, dashboard
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_labour_facility_status" ON labour_records (facility_id, status)`,
    );

    // 3. Index on delivery_outcomes(labour_record_id) — baby outcome lookups
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_outcome_labour_record" ON delivery_outcomes (labour_record_id)`,
    );

    // 4. Composite index on immunization_schedules(facility_id, status, due_date) — due/defaulter queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_immunization_facility_status_due" ON immunization_schedules (facility_id, status, due_date)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_immunization_facility_status_due"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_outcome_labour_record"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_labour_facility_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_anc_facility_status"`);
  }
}
