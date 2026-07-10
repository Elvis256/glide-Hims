import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allow audit_logs.user_id to be NULL and add attempted_identifier so we can
 * record failed login attempts for unknown usernames (no resolvable user).
 */
export class AuditLogsLoginSupport1782900000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS attempted_identifier varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS error_message text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS error_message`);
    await queryRunner.query(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS attempted_identifier`);
    // Note: leave user_id nullable on rollback; reverting could orphan rows.
  }
}
