import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — Lead Pipeline Enhancement: adds pipeline fields to leads table
 * and creates the lead_activities table for CRM activity tracking.
 */
export class LeadPipelineEnhancements1782900000037 implements MigrationInterface {
  name = 'LeadPipelineEnhancements1782900000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add pipeline columns to leads (no explicit name: in entity → camelCase)
    await queryRunner.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS "assignedTo" UUID;`);
    await queryRunner.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority VARCHAR(20);`);
    await queryRunner.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS "lastContactedAt" TIMESTAMPTZ;`);
    await queryRunner.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMPTZ;`);
    await queryRunner.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS "estimatedArrMinor" INTEGER NOT NULL DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS "estimatedArrCurrency" VARCHAR(3) NOT NULL DEFAULT 'UGX';`);

    // Create lead_activities table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lead_activities (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        type        VARCHAR(50) NOT NULL,
        content     TEXT,
        metadata    JSONB,
        "actorId"   UUID,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities (lead_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lead_activities_type ON lead_activities (type);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lead_activities;`);
    await queryRunner.query(`ALTER TABLE leads DROP COLUMN IF EXISTS "estimatedArrCurrency";`);
    await queryRunner.query(`ALTER TABLE leads DROP COLUMN IF EXISTS "estimatedArrMinor";`);
    await queryRunner.query(`ALTER TABLE leads DROP COLUMN IF EXISTS "nextFollowUpAt";`);
    await queryRunner.query(`ALTER TABLE leads DROP COLUMN IF EXISTS "lastContactedAt";`);
    await queryRunner.query(`ALTER TABLE leads DROP COLUMN IF EXISTS priority;`);
    await queryRunner.query(`ALTER TABLE leads DROP COLUMN IF EXISTS "assignedTo";`);
  }
}
