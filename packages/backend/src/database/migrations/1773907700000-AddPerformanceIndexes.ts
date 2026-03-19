import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1773907700000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1773907700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Queue: composite index for patient queue lookups
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_queue_patient_facility_date_status"
       ON "queues" ("patient_id", "facility_id", "queue_date", "status")`,
    );

    // Lab results: indexes for sample lookup, abnormal filtering, status filtering
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lab_results_sampleId"
       ON "lab_results" ("sampleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lab_results_abnormalFlag"
       ON "lab_results" ("abnormalFlag")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lab_results_status"
       ON "lab_results" ("status")`,
    );

    // Lab samples: index for status + time ordering
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_lab_samples_status_createdAt"
       ON "lab_samples" ("status", "created_at")`,
    );

    // Pharmacy sales: status + time, prescription lookup
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pharmacy_sales_status_createdAt"
       ON "pharmacy_sales" ("status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_pharmacy_sales_prescriptionId"
       ON "pharmacy_sales" ("prescription_id")`,
    );

    // Invoice items: prevent double-billing (unique on referenceType + referenceId)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_items_ref_type_id"
       ON "invoice_items" ("reference_type", "reference_id")
       WHERE "reference_type" IS NOT NULL AND "reference_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_items_ref_type_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pharmacy_sales_prescriptionId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pharmacy_sales_status_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lab_samples_status_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lab_results_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lab_results_abnormalFlag"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lab_results_sampleId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_queue_patient_facility_date_status"`);
  }
}
