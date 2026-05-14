import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unify payment-method enums across patient-side payments and supplier payments.
 *
 * - Adds the four coverage methods to `payments_method_enum`
 *   (membership, hospital_scheme, staff, credit) — these were previously
 *   only string-typed on queue entries and never reachable in invoice payments.
 *
 * - Renames `credit_card` → `card` in `supplier_payments_payment_method_enum`
 *   so vendor / patient payment reports can share dashboards.
 *
 * - Backfills any historical `credit_card` rows in supplier_payments to `card`
 *   (PG's RENAME VALUE handles the underlying data automatically, but the
 *    explicit UPDATE makes the intent obvious).
 */
export class UnifyPaymentMethods1782900000021 implements MigrationInterface {
  name = 'UnifyPaymentMethods1782900000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // payments_method_enum: add new coverage methods (idempotent via IF NOT EXISTS)
    for (const v of ['membership', 'hospital_scheme', 'staff', 'credit']) {
      await queryRunner.query(`ALTER TYPE "payments_method_enum" ADD VALUE IF NOT EXISTS '${v}'`);
    }

    // supplier_payments_payment_method_enum: rename credit_card → card.
    const hasCreditCard: { exists: boolean }[] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'supplier_payments_payment_method_enum'
          AND e.enumlabel = 'credit_card'
      ) AS exists
    `);
    if (hasCreditCard[0]?.exists) {
      const hasCard: { exists: boolean }[] = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'supplier_payments_payment_method_enum'
            AND e.enumlabel = 'card'
        ) AS exists
      `);
      if (hasCard[0]?.exists) {
        // Both labels exist: update rows, then we cannot drop a label easily —
        // leave both. Future writes will use 'card'.
        await queryRunner.query(
          `UPDATE supplier_payments SET payment_method = 'card' WHERE payment_method = 'credit_card'`,
        );
      } else {
        await queryRunner.query(
          `ALTER TYPE "supplier_payments_payment_method_enum" RENAME VALUE 'credit_card' TO 'card'`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Enum value removal is intentionally not implemented — Postgres makes it
    // unsafe and we don't want to lose audit data. This is a forward-only
    // unification.
    void queryRunner;
  }
}
