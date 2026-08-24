import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogsCryptographicHash1782900000040 implements MigrationInterface {
  // Raw SQL rather than queryRunner.addColumns(), which has no "if not exists"
  // form: audit_logs predates the migration chain and is created by
  // BaselineSchema1690000000000 already carrying these columns, so a bare
  // unconditional ADD COLUMN aborts a build from an empty database.
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['audit_logs', 'admin_audit_log']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "hash" character varying(64) NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "previous_hash" character varying(64) NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('admin_audit_log', 'previous_hash');
    await queryRunner.dropColumn('admin_audit_log', 'hash');
    await queryRunner.dropColumn('audit_logs', 'previous_hash');
    await queryRunner.dropColumn('audit_logs', 'hash');
  }
}
