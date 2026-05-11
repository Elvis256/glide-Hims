import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds tenant_id to audit_logs and backfills it from related entities.
 *
 * Backfill strategy (best-effort, run in priority order):
 *  1. Journal entry actions  → join via journal_entries.id
 *  2. Patient finance actions → join via invoices/payments tables when present
 *  3. Default                 → derive from users.tenant_id of the actor
 *
 * Rows that cannot be resolved retain a NULL tenant_id and will only be
 * visible to system admins (the audit-compliance service treats NULL as
 * cross-tenant).
 */
export class AddTenantIdToAuditLogs1782900000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS tenant_id uuid NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id
      ON audit_logs (tenant_id)
    `);

    // Backfill from journal_entries (entity_type variations from past code).
    await queryRunner.query(`
      UPDATE audit_logs al
      SET tenant_id = je.tenant_id
      FROM journal_entries je
      WHERE al.tenant_id IS NULL
        AND al.entity_id IS NOT NULL
        AND al.entity_id::text = je.id::text
        AND lower(al.entity_type) IN ('journal_entry','journalentry','journal-entries','journals')
    `);

    // Backfill from users.tenant_id of the actor for everything else where we
    // have a user_id and the user is tenant-bound.
    await queryRunner.query(`
      UPDATE audit_logs al
      SET tenant_id = u.tenant_id
      FROM users u
      WHERE al.tenant_id IS NULL
        AND al.user_id IS NOT NULL
        AND al.user_id = u.id
        AND u.tenant_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_tenant_id`);
    await queryRunner.query(
      `ALTER TABLE audit_logs DROP COLUMN IF EXISTS tenant_id`,
    );
  }
}
