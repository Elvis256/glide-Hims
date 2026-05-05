import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinanceApprovalMakerChecker1782000000000 implements MigrationInterface {
  name = 'FinanceApprovalMakerChecker1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create ENUM type for approval status
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE finance_approval_status AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // 2. Create ENUM for journal entry status
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE journal_entry_approval_status AS ENUM ('draft', 'submitted', 'approved', 'posted', 'rejected', 'reversed');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // 3. Update journal_entries table with approval fields
    await queryRunner.query(`
      ALTER TABLE journal_entries
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID,
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS approval_amount_threshold DECIMAL(20, 2);
    `);

    // 4. Create finance_approval_chains table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_approval_chains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID,
        facility_id UUID NOT NULL,
        journal_entry_id UUID NOT NULL UNIQUE REFERENCES journal_entries(id) ON DELETE CASCADE,
        approval_level INT NOT NULL CHECK (approval_level >= 1 AND approval_level <= 4),
        required_role VARCHAR(100) NOT NULL,
        status finance_approval_status NOT NULL DEFAULT 'pending',
        approver_id UUID,
        approved_by_id UUID REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        rejection_reason TEXT,
        comments TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // 5. Create indexes for finance_approval_chains
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_finance_approval_journal_entry ON finance_approval_chains(journal_entry_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_finance_approval_status ON finance_approval_chains(status);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_finance_approval_facility_role ON finance_approval_chains(facility_id, required_role);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_finance_approval_created ON finance_approval_chains(created_at);`,
    );

    // 6. Add indexes to journal_entries for approval workflow
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_journal_approval_status ON journal_entries(approval_status);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_journal_submitted_at ON journal_entries(submitted_at);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_journal_submitted_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_journal_approval_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_finance_approval_created;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_finance_approval_facility_role;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_finance_approval_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_finance_approval_journal_entry;`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS finance_approval_chains;`);

    // Revert journal_entries columns
    await queryRunner.query(`
      ALTER TABLE journal_entries
      DROP COLUMN IF EXISTS approval_amount_threshold,
      DROP COLUMN IF EXISTS approval_required,
      DROP COLUMN IF EXISTS submitted_at,
      DROP COLUMN IF EXISTS submitted_by_user_id,
      DROP COLUMN IF EXISTS approval_status;
    `);

    // Drop ENUMs
    await queryRunner.query(`DROP TYPE IF EXISTS journal_entry_approval_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS finance_approval_status;`);
  }
}
