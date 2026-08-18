import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records which payment voucher a supplier credit/debit note was applied to,
 * and for how much.
 *
 * applyCreditNote took a paymentVoucherId, consumed the note's balance and
 * recorded the voucher id in an audit line — nowhere queryable. So nothing
 * could tell which of a voucher's deductions came from a credit note, and
 * cancelling a voucher silently destroyed any credit applied to it: the note
 * stayed spent, the voucher it was spent on ceased to exist.
 *
 * A note can be split across several vouchers, so this is a link table rather
 * than a column on either side.
 */
export class SupplierCreditNoteApplications1782900000090 implements MigrationInterface {
  name = 'SupplierCreditNoteApplications1782900000090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "supplier_credit_note_applications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "credit_note_id" uuid NOT NULL,
        "payment_voucher_id" uuid NOT NULL,
        "amount" decimal(15,2) NOT NULL,
        "applied_by" uuid,
        "applied_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "reversed_at" timestamptz NULL,
        "reversed_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" timestamptz NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cna_tenant" ON "supplier_credit_note_applications" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cna_note" ON "supplier_credit_note_applications" ("credit_note_id")`,
    );
    // The reversal path looks applications up by voucher.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cna_voucher" ON "supplier_credit_note_applications" ("payment_voucher_id")`,
    );

    // RLS from day one (new tenant-scoped table)
    const tenantMatch = `
      current_setting('app.tenant', true) = 'system'
      OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
    `;
    await queryRunner.query(
      `ALTER TABLE "supplier_credit_note_applications" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "supplier_credit_note_applications"`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation" ON "supplier_credit_note_applications"
      USING (${tenantMatch})
      WITH CHECK (${tenantMatch})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_credit_note_applications"`);
  }
}
