import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingTableIndexes1774300000000 implements MigrationInterface {
  name = 'AddMissingTableIndexes1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Facilities: lookup by status
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_facilities_status" ON "facilities" ("status")`,
    );

    // Tenants: lookup by status
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenants_status" ON "tenants" ("status") WHERE "deleted_at" IS NULL`,
    );

    // Nursing notes: lookup by admission and nurse
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_nursing_notes_admission" ON "nursing_notes" ("admissionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_nursing_notes_nurse" ON "nursing_notes" ("nurseId")`,
    );

    // Password history: lookup by user for password reuse check
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_password_history_user" ON "password_history" ("user_id")`,
    );

    // Beds: ward + status lookup
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_beds_ward_status" ON "beds" ("wardId", "status") WHERE "deleted_at" IS NULL`,
    );

    // Leave requests: employee + status lookup
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_leave_requests_employee_status" ON "leave_requests" ("employee_id", "status")`,
    );

    // Insurance policies: patient lookup
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_insurance_policies_patient" ON "insurance_policies" ("patient_id") WHERE "deleted_at" IS NULL`,
    );

    // Chart of accounts: tenant + type
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chart_of_accounts_tenant_type" ON "chart_of_accounts" ("tenant_id", "account_type")`,
    );

    // Journal entry lines: journal entry parent
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_journal_entry_lines_entry" ON "journal_entry_lines" ("journal_entry_id")`,
    );

    // Doctor schedules: doctor lookup
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_doctor_schedules_doctor" ON "doctor_schedules" ("doctor_id")`,
    );

    // Claim items: claim parent
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_claim_items_claim" ON "claim_items" ("claim_id")`,
    );

    // Prescriptions: number lookup for sequence generation
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prescriptions_number" ON "prescriptions" ("prescription_number")`,
    );

    // Invoices: number lookup for sequence generation
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invoices_number" ON "invoices" ("invoice_number")`,
    );

    // Payments: receipt number lookup for sequence generation
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payments_receipt_number" ON "payments" ("receipt_number")`,
    );

    // Asset tracking
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_asset_maintenances_asset" ON "asset_maintenances" ("asset_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_asset_transfers_asset" ON "asset_transfers" ("asset_id")`,
    );

    // Shift swap requests
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_shift_swap_requests_target_status" ON "shift_swap_requests" ("target_employee_id", "status")`,
    );

    // Attendance
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_attendance_records_employee_date" ON "attendance_records" ("employee_id", "date")`,
    );

    // Fiscal periods: year lookup
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fiscal_periods_tenant_year" ON "fiscal_periods" ("tenant_id", "fiscal_year")`,
    );

    // Imaging modalities: facility
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_imaging_modalities_facility" ON "imaging_modalities" ("facility_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_facilities_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenants_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_nursing_notes_admission"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_nursing_notes_nurse"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_password_history_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_beds_ward_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_leave_requests_employee_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_insurance_policies_patient"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chart_of_accounts_tenant_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_journal_entry_lines_entry"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_doctor_schedules_doctor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_claim_items_claim"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescriptions_number"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_number"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_receipt_number"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_maintenances_asset"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_transfers_asset"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_shift_swap_requests_target_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attendance_records_employee_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fiscal_periods_tenant_year"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_imaging_modalities_facility"`);
  }
}
