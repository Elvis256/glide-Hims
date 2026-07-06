import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingEnhancements1782900000051 implements MigrationInterface {
  name = 'BillingEnhancements1782900000051';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add WRITTEN_OFF to invoice status enum
    await queryRunner.query(
      `ALTER TYPE invoices_status_enum ADD VALUE IF NOT EXISTS 'written_off'`,
    );

    // 2. Add gl_posted boolean to payments table (default true)
    await queryRunner.query(
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS gl_posted BOOLEAN NOT NULL DEFAULT true`,
    );

    // 3. Add index on payments.transaction_reference for duplicate-check lookups
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payments_transaction_reference" ON payments (transaction_reference)`,
    );

    // 4. Add index on invoices.insurance_policy_id for pre-auth and addBillableItem queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invoices_insurance_policy_id" ON invoices (insurance_policy_id)`,
    );

    // 5. Add index on invoice_items.service_code for revenue reporting group-by
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_items_service_code" ON invoice_items (service_code)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_items_service_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_insurance_policy_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_transaction_reference"`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS gl_posted`);
    // Note: PostgreSQL does not support removing enum values; the WRITTEN_OFF value is harmless if kept.
  }
}
