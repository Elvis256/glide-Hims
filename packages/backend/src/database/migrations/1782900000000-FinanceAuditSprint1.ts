import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint-1 finance audit remediations:
 *  1. Drop global UNIQUE on journal_entries.journal_number; replace with
 *     tenant-scoped UNIQUE (tenant_id, journal_number) so two tenants can
 *     legitimately share an auto-generated journal number.
 *  2. Add tenant-scoped UNIQUE (tenant_id, account_code) on chart_of_accounts.
 *  3. Drop the non-unique index on finance_approval_chains(journal_entry_id,
 *     approval_level) and replace with a UNIQUE index so the same approval
 *     level cannot be inserted twice for the same journal entry.
 *  4. Seed the new finance permissions referenced by the controllers added
 *     in this sprint (finance.journals.submit / approve / reverse,
 *     finance.periods.lock, finance.admin) and grant them to existing
 *     finance roles via finance.manage holders so admins are not locked out.
 */
export class FinanceAuditSprint11782900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. journal_entries: tenant-scoped journal number uniqueness ──────────
    await queryRunner.query(`
      DO $$
      DECLARE
        c TEXT;
      BEGIN
        FOR c IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'journal_entries'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) ILIKE '%(journal_number)%'
        LOOP
          EXECUTE 'ALTER TABLE journal_entries DROP CONSTRAINT ' || quote_ident(c);
        END LOOP;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE journal_entries
      ADD CONSTRAINT uq_journal_entries_tenant_journal_number
      UNIQUE (tenant_id, journal_number)
    `);

    // ── 2. chart_of_accounts: tenant-scoped account code uniqueness ─────────
    await queryRunner.query(`
      ALTER TABLE chart_of_accounts
      ADD CONSTRAINT uq_chart_of_accounts_tenant_account_code
      UNIQUE (tenant_id, account_code)
    `);

    // ── 3. finance_approval_chains: unique (journal_entry_id, approval_level)
    await queryRunner.query(`
      DO $$
      DECLARE
        i TEXT;
      BEGIN
        FOR i IN
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'finance_approval_chains'
            AND indexdef ILIKE '%(journal_entry_id, approval_level)%'
            AND indexdef NOT ILIKE '%UNIQUE%'
        LOOP
          EXECUTE 'DROP INDEX ' || quote_ident(i);
        END LOOP;
      END$$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_approval_journal_level
      ON finance_approval_chains (journal_entry_id, approval_level)
    `);

    // ── 4. Seed new finance permissions (idempotent) ─────────────────────────
    const newPermissions: Array<[string, string]> = [
      ['finance.journals.submit', 'Submit Journal Entries for Approval'],
      ['finance.journals.approve', 'Approve Journal Entries'],
      ['finance.journals.reverse', 'Reverse Posted Journal Entries'],
      ['finance.periods.lock', 'Lock Fiscal Periods'],
      ['finance.admin', 'Finance Administration (cleanup, integrity, compliance)'],
    ];

    for (const [code, name] of newPermissions) {
      await queryRunner.query(
        `INSERT INTO permissions (code, name, module)
         VALUES ($1, $2, 'finance')
         ON CONFLICT (code) DO NOTHING`,
        [code, name],
      );
    }

    // Grant the new permissions to every role that already holds finance.manage.
    // This preserves existing operational access while letting the new
    // RBAC decorators work without locking admins out of finance endpoints.
    await queryRunner.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT DISTINCT rp.role_id, p_new.id
      FROM role_permissions rp
      JOIN permissions p_old ON p_old.id = rp.permission_id
      CROSS JOIN permissions p_new
      WHERE p_old.code = 'finance.manage'
        AND p_new.code IN (
          'finance.journals.submit',
          'finance.journals.approve',
          'finance.journals.reverse',
          'finance.periods.lock',
          'finance.admin'
        )
        AND NOT EXISTS (
          SELECT 1 FROM role_permissions rp2
          WHERE rp2.role_id = rp.role_id AND rp2.permission_id = p_new.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new constraints/indexes; do not remove the seeded permissions
    // since they may have been granted to additional roles by tenants.
    await queryRunner.query(`
      ALTER TABLE journal_entries
      DROP CONSTRAINT IF EXISTS uq_journal_entries_tenant_journal_number
    `);
    await queryRunner.query(`
      ALTER TABLE chart_of_accounts
      DROP CONSTRAINT IF EXISTS uq_chart_of_accounts_tenant_account_code
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_finance_approval_journal_level
    `);
  }
}
