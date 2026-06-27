import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add composite indexes for the most frequent query patterns
 * to improve performance on list/queue/dashboard endpoints.
 */
export class AddCompositeIndexes1782900000049 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Encounters: queried by status+facility+date on queue/dashboard pages
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_encounters_status_facility_date
      ON encounters (status, facility_id, created_at DESC)
      WHERE deleted_at IS NULL
    `);

    // Encounters: queried by patient+status for patient history
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_encounters_patient_status
      ON encounters (patient_id, status)
      WHERE deleted_at IS NULL
    `);

    // Invoices: queried by patient+status on billing pages
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_patient_status
      ON invoices (patient_id, status)
      WHERE deleted_at IS NULL
    `);

    // Invoices: queried by tenant+status+date for dashboards
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status_date
      ON invoices (tenant_id, status, created_at DESC)
      WHERE deleted_at IS NULL
    `);

    // Lab samples: queried by status+tenant on lab queue (camelCase columns)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lab_samples_status_tenant
      ON lab_samples (status, tenant_id, created_at DESC)
    `);

    // Lab samples: queried by order for result grouping (camelCase column)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lab_samples_order
      ON lab_samples ("orderId")
    `);

    // Prescriptions: queried by encounter for consultation page
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter
      ON prescriptions (encounter_id)
      WHERE deleted_at IS NULL
    `);

    // Prescription items: queried by prescription + dispensed status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_prescription_items_rx_dispensed
      ON prescription_items (prescription_id, is_dispensed)
    `);

    // Queue (queues table): queried by status+servicePoint on queue pages (camelCase column)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_queues_status_service
      ON queues (status, "servicePoint", created_at DESC)
      WHERE deleted_at IS NULL
    `);

    // Medication administration: queried by prescription for MAR
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_med_admin_prescription
      ON medication_administrations (prescription_id, administered_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_med_admin_prescription`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_queues_status_service`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_prescription_items_rx_dispensed`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_prescriptions_encounter`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lab_samples_order`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lab_samples_status_tenant`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_tenant_status_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_patient_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_encounters_patient_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_encounters_status_facility_date`);
  }
}
