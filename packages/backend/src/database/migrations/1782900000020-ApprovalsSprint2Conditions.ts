import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 2 of the Approvals framework.
 *
 *   - JSONLogic conditions on policy steps (`condition` jsonb).
 *   - SLA + escalation: `sla_hours` and `escalate_to_user_id` on policy
 *     steps, and `sla_hours` / `sla_due_at` / `escalated_at` on chain rows
 *     so the cron worker can find breached steps in O(index).
 */
export class ApprovalsSprint2Conditions1782900000020 implements MigrationInterface {
  name = 'ApprovalsSprint2Conditions1782900000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE procurement_approval_policy_steps
        ADD COLUMN IF NOT EXISTS condition JSONB NULL,
        ADD COLUMN IF NOT EXISTS sla_hours INT NULL,
        ADD COLUMN IF NOT EXISTS escalate_to_user_id UUID NULL
    `);
    await queryRunner.query(`
      ALTER TABLE procurement_approval_chains
        ADD COLUMN IF NOT EXISTS sla_hours INT NULL,
        ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_procurement_approval_chains_sla_due
        ON procurement_approval_chains (status, sla_due_at)
        WHERE sla_due_at IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_procurement_approval_chains_sla_due`);
    await queryRunner.query(`
      ALTER TABLE procurement_approval_chains
        DROP COLUMN IF EXISTS escalated_at,
        DROP COLUMN IF EXISTS sla_due_at,
        DROP COLUMN IF EXISTS sla_hours
    `);
    await queryRunner.query(`
      ALTER TABLE procurement_approval_policy_steps
        DROP COLUMN IF EXISTS escalate_to_user_id,
        DROP COLUMN IF EXISTS sla_hours,
        DROP COLUMN IF EXISTS condition
    `);
  }
}
