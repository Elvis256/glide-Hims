import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Follow-up to 1782900000065: a full catalog sweep found 31 more tables whose
 * tenant-generated document numbers carry GLOBAL unique constraints. With more
 * than one tenant, two facilities reaching the same sequence collide with
 * unique_violation 500s. providers.license_number / registration_number are
 * worse: the same real-world provider registered at two tenants is simply
 * rejected. All converted to composite (tenant_id, number) uniqueness.
 *
 * Constraint/index names are discovered dynamically (TypeORM hash names can
 * differ between deployments).
 */
export class PerTenantDocumentNumbers21782900000066 implements MigrationInterface {
  name = 'PerTenantDocumentNumbers21782900000066';

  private static readonly TARGETS: Array<{ table: string; column: string }> = [
    { table: 'antenatal_registrations', column: 'anc_number' },
    { table: 'batch_recalls', column: 'recall_number' },
    { table: 'cashier_sessions', column: 'session_number' },
    { table: 'cycle_counts', column: 'count_number' },
    { table: 'discharge_summaries', column: 'discharge_number' },
    { table: 'employees', column: 'employee_number' },
    { table: 'encounters', column: 'visit_number' },
    { table: 'fixed_assets', column: 'serial_number' },
    { table: 'goods_receipt_notes', column: 'grn_number' },
    { table: 'insurance_claims', column: 'claim_number' },
    { table: 'interfacility_transactions', column: 'reference_number' },
    { table: 'invoice_matches', column: 'match_number' },
    { table: 'labour_records', column: 'labour_number' },
    { table: 'patient_credit_notes', column: 'note_number' },
    { table: 'patient_deposits', column: 'deposit_number' },
    { table: 'patient_memberships', column: 'membership_number' },
    { table: 'payroll_runs', column: 'payroll_number' },
    { table: 'pharmacy_returns', column: 'return_number' },
    { table: 'pharmacy_sales', column: 'sale_number' },
    { table: 'pos_z_reports', column: 'report_number' },
    { table: 'pre_authorizations', column: 'auth_number' },
    { table: 'purchase_requests', column: 'request_number' },
    { table: 'rfqs', column: 'rfq_number' },
    { table: 'stock_transfers', column: 'transfer_number' },
    { table: 'supplier_credit_notes', column: 'note_number' },
    { table: 'supplier_payments', column: 'voucher_number' },
    { table: 'supplier_returns', column: 'return_number' },
    { table: 'treatment_plans', column: 'plan_number' },
    { table: 'vendor_contracts', column: 'contract_number' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of PerTenantDocumentNumbers21782900000066.TARGETS) {
      // Drop every single-column UNIQUE constraint on exactly this column
      const constraints: Array<{ conname: string }> = await queryRunner.query(
      `SELECT c.conname
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = $1 AND c.contype = 'u'
            AND array_length(c.conkey, 1) = 1
            AND (SELECT attname FROM pg_attribute
                  WHERE attrelid = t.oid AND attnum = c.conkey[1]) = $2`,
        [table, column],
      );
      for (const { conname } of constraints) {
        await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${conname}"`);
      }

      // Drop leftover standalone single-column UNIQUE indexes not constraint-backed
      const indexes: Array<{ indexname: string }> = await queryRunner.query(
        `SELECT i.indexname
           FROM pg_indexes i
          WHERE i.schemaname = 'public' AND i.tablename = $1
            AND i.indexdef LIKE 'CREATE UNIQUE INDEX%'
            AND i.indexdef LIKE '%(' || $2 || ')%'`,
        [table, column],
      );
      for (const { indexname } of indexes) {
        await queryRunner.query(`DROP INDEX IF EXISTS "${indexname}"`);
      }

      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "UQ_${table}_tenant_${column}" UNIQUE ("tenant_id", "${column}")`,
      );
    }

    // providers uses soft-delete-aware PARTIAL unique indexes — recreate as
    // composite partial indexes (plain constraints would block re-registering
    // a soft-deleted provider's license/registration number)
    for (const col of ['license_number', 'registration_number']) {
      const partials: Array<{ indexname: string }> = await queryRunner.query(
        `SELECT indexname FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'providers'
            AND indexdef LIKE 'CREATE UNIQUE INDEX%'
            AND indexdef LIKE '%(' || $1 || ')%'`,
        [col],
      );
      for (const { indexname } of partials) {
        await queryRunner.query(`DROP INDEX IF EXISTS "${indexname}"`);
      }
      await queryRunner.query(
        `CREATE UNIQUE INDEX "UQ_providers_tenant_${col}" ON "providers" ("tenant_id", "${col}")
          WHERE deleted_at IS NULL AND "${col}" IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of PerTenantDocumentNumbers21782900000066.TARGETS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "UQ_${table}_tenant_${column}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "UQ_${table}_${column}" UNIQUE ("${column}")`,
      );
    }
    for (const col of ['license_number', 'registration_number']) {
      await queryRunner.query(`DROP INDEX IF EXISTS "UQ_providers_tenant_${col}"`);
      await queryRunner.query(
        `CREATE UNIQUE INDEX "UQ_providers_${col}" ON "providers" ("${col}")
          WHERE deleted_at IS NULL AND "${col}" IS NOT NULL`,
      );
    }
  }
}
