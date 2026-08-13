import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add the BaseEntity audit columns missing from the usage-meter and
 * admin-audit tables.
 *
 * CreateUsageMeterTables1777800000000 and CreateAdminAuditLogTable1777900000000
 * omitted `deleted_at` (and `updated_at` on admin_audit_log) even though every
 * one of these entities extends BaseEntity, which declares @UpdateDateColumn
 * and @DeleteDateColumn. Those two migrations have since been corrected, which
 * fixes any database built from them — but not a database where they are
 * already recorded as applied. Production is exactly that case: the tables
 * exist, the migrations are in the ledger, and every read through their
 * repositories fails with `column ... deleted_at does not exist`.
 *
 * Idempotent, so it is a no-op wherever the corrected migrations did run.
 */
export class UsageMeterAuditColumns1782900000089 implements MigrationInterface {
  name = 'UsageMeterAuditColumns1782900000089';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['usage_meter_aggregate', 'usage_quota', 'usage_alert']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp NULL`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "admin_audit_log" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_audit_log" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['usage_meter_aggregate', 'usage_quota', 'usage_alert']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "deleted_at"`);
    }
    await queryRunner.query(`ALTER TABLE "admin_audit_log" DROP COLUMN IF EXISTS "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "admin_audit_log" DROP COLUMN IF EXISTS "updated_at"`);
  }
}
