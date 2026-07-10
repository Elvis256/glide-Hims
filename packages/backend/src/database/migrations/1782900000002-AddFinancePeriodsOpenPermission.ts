import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint-3: introduces a dedicated `finance.periods.open` permission.
 * Previously, openPeriod used finance.periods.close which incorrectly
 * coupled the two operations. We seed the new permission and grant it to
 * any role that already has finance.periods.close so behaviour is preserved.
 */
export class AddFinancePeriodsOpenPermission1782900000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO permissions (code, name, module)
       VALUES ('finance.periods.open', 'Re-open Closed Fiscal Periods', 'finance')
       ON CONFLICT (code) DO NOTHING`,
    );

    await queryRunner.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT DISTINCT rp.role_id, p_new.id
      FROM role_permissions rp
      JOIN permissions p_old ON p_old.id = rp.permission_id
      CROSS JOIN permissions p_new
      WHERE p_old.code IN ('finance.periods.close', 'finance.manage')
        AND p_new.code = 'finance.periods.open'
        AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp2
          WHERE rp2.role_id = rp.role_id AND rp2.permission_id = p_new.id
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Keep permission to avoid orphaning role_permissions assignments
    // operators may have added manually.
  }
}
