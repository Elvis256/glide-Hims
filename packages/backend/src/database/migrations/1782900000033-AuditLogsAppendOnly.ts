import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Make audit_logs append-only at the database layer.
 *
 * Even with controllers locked down, a SQL-injection bug or a
 * compromised service account could otherwise erase or rewrite audit
 * trail rows. We install row-level triggers that raise on UPDATE and
 * DELETE, with a single escape hatch: a per-transaction setting
 * `app.allow_audit_purge` set to 'on' lets a maintenance task
 * legitimately prune old rows (e.g., retention policy) when run
 * manually and intentionally:
 *
 *   BEGIN;
 *     SET LOCAL app.allow_audit_purge = 'on';
 *     DELETE FROM audit_logs WHERE created_at < now() - interval '7 years';
 *   COMMIT;
 *
 * UPDATE has no escape hatch — audit log rows are immutable by design.
 */
export class AuditLogsAppendOnly1782900000033 implements MigrationInterface {
  name = 'AuditLogsAppendOnly1782900000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_logs_block_update()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs rows are immutable (no UPDATE allowed)';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_logs_block_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        IF current_setting('app.allow_audit_purge', true) = 'on' THEN
          RETURN OLD;
        END IF;
        RAISE EXCEPTION 'audit_logs rows are immutable (set app.allow_audit_purge=on for retention purge)';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs`,
    );
    await queryRunner.query(`
      CREATE TRIGGER trg_audit_logs_no_update
        BEFORE UPDATE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION audit_logs_block_update();
    `);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs`,
    );
    await queryRunner.query(`
      CREATE TRIGGER trg_audit_logs_no_delete
        BEFORE DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION audit_logs_block_delete();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_logs_block_update()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_logs_block_delete()`);
  }
}
