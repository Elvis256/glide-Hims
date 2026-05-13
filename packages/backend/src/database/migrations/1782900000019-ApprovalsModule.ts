import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 1 of the cross-cutting Approvals framework.
 *
 * Strategy: NON-DESTRUCTIVE EXTEND.
 *  - Keeps existing procurement_approval_chains / procurement_approval_policies
 *    tables and their data intact.
 *  - Adds a polymorphic `module` column (default 'procurement') so the same
 *    rows can serve other modules (HR, Finance, Pharmacy, …).
 *  - Adds an `approval_actions` audit table that records every state change
 *    for any approval chain across all modules.
 *
 * A future migration will rename the tables to drop the `procurement_`
 * prefix once all callers have been updated.
 */
export class ApprovalsModule1782900000019 implements MigrationInterface {
  name = 'ApprovalsModule1782900000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- 1. Add `module` column to chains + policies for polymorphism ----
    await queryRunner.query(`
      ALTER TABLE procurement_approval_chains
        ADD COLUMN IF NOT EXISTS module VARCHAR(50) NOT NULL DEFAULT 'procurement'
    `);
    await queryRunner.query(`
      ALTER TABLE procurement_approval_policies
        ADD COLUMN IF NOT EXISTS module VARCHAR(50) NOT NULL DEFAULT 'procurement'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_procurement_approval_chains_module_doc
        ON procurement_approval_chains (module, document_type, document_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_procurement_approval_policies_module
        ON procurement_approval_policies (module, tenant_id)
    `);

    // ---- 2. Add group_id + quorum columns on chain rows so the resolver
    //         can persist group steps (previously the resolver yielded these
    //         in memory but the chain table didn't have columns to store them) ----
    await queryRunner.query(`
      ALTER TABLE procurement_approval_chains
        ADD COLUMN IF NOT EXISTS group_id UUID NULL,
        ADD COLUMN IF NOT EXISTS quorum_type VARCHAR(20) NULL,
        ADD COLUMN IF NOT EXISTS quorum_count INT NULL
    `);

    // ---- 3. Audit trail table -------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS approval_actions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NULL,
        chain_id UUID NOT NULL,
        chain_step_id UUID NULL,
        module VARCHAR(50) NOT NULL,
        document_type VARCHAR(20) NOT NULL,
        document_id VARCHAR(64) NOT NULL,
        actor_user_id UUID NULL,
        action VARCHAR(30) NOT NULL,
          /* submit | approve | reject | delegate | escalate | recall | comment */
        comment TEXT NULL,
        ip_address VARCHAR(64) NULL,
        user_agent TEXT NULL,
        before_json JSONB NULL,
        after_json JSONB NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_approval_actions_doc
        ON approval_actions (module, document_type, document_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_approval_actions_actor
        ON approval_actions (actor_user_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_approval_actions_tenant_created
        ON approval_actions (tenant_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS approval_actions`);
    await queryRunner.query(`
      ALTER TABLE procurement_approval_chains
        DROP COLUMN IF EXISTS group_id,
        DROP COLUMN IF EXISTS quorum_type,
        DROP COLUMN IF EXISTS quorum_count
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_procurement_approval_policies_module
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_procurement_approval_chains_module_doc
    `);
    await queryRunner.query(`
      ALTER TABLE procurement_approval_chains DROP COLUMN IF EXISTS module
    `);
    await queryRunner.query(`
      ALTER TABLE procurement_approval_policies DROP COLUMN IF EXISTS module
    `);
  }
}
