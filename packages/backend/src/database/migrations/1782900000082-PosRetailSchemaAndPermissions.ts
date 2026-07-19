import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * POS retail hardening (Block 11 frontend review):
 *
 * 1. Seven retail tables were created without the `deleted_at` column their
 *    entities declare via @DeleteDateColumn — every read through those repos
 *    500'd with `column X.deleted_at does not exist` (held sales, returns,
 *    quick keys, reprints, retail customers were ALL dead in production).
 *
 * 2. The `pos.*` / `wholesale.manage` permission codes used by the POS
 *    controllers were never seeded into the permissions catalog, so no role
 *    could ever be granted them — every permission-gated POS endpoint was
 *    Super-Admin-only by accident.
 */
export class PosRetailSchemaAndPermissions1782900000082 implements MigrationInterface {
  name = 'PosRetailSchemaAndPermissions1782900000082';

  private tables = [
    'pharmacy_returns',
    'pharmacy_return_items',
    'held_sales',
    'discount_applications',
    'receipt_reprints',
    'pos_quick_keys',
    'retail_customers',
  ];

  private permissions: Array<[string, string]> = [
    ['pos.read', 'View POS'],
    ['pos.manage', 'Manage POS registers & shifts list'],
    ['pos.shift', 'Open and close POS shifts'],
    ['pos.sale.hold', 'Hold and recall POS sales'],
    ['pos.sale.void', 'Void POS sales'],
    ['pos.return.create', 'Process POS returns'],
    ['pos.return.read', 'View POS returns'],
    ['pos.discount.line', 'Apply POS discounts'],
    ['pos.drawer.manage', 'Record cash drawer events'],
    ['pos.quickkey.manage', 'Manage POS quick keys'],
    ['pos.customer.read', 'Look up retail customers'],
    ['pos.patient.link', 'Link POS sales to patients'],
    ['pos.receipt.reprint', 'Reprint POS receipts'],
    ['wholesale.manage', 'Manage wholesale customers & pricing tiers'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const t of this.tables) {
      await queryRunner.query(
        `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz NULL`,
      );
    }
    for (const [code, name] of this.permissions) {
      await queryRunner.query(
        `INSERT INTO permissions (id, code, name, module, tenant_id)
           SELECT gen_random_uuid(), $1::varchar, $2::varchar, 'pos', NULL
           WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = $1::varchar AND deleted_at IS NULL)`,
        [code, name],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of this.tables) {
      await queryRunner.query(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "deleted_at"`);
    }
    await queryRunner.query(
      `DELETE FROM permissions WHERE module = 'pos' AND code = ANY($1)`,
      [this.permissions.map(([c]) => c)],
    );
  }
}
