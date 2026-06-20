import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 — Client Onboarding: creates onboarding tracking tables.
 */
export class ClientOnboarding1782900000039 implements MigrationInterface {
  name = 'ClientOnboarding1782900000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS client_onboardings (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID,
        deployment_id         UUID,
        quotation_id          UUID,
        subscription_id       UUID,
        status                VARCHAR(30) NOT NULL DEFAULT 'not_started',
        "progressPercent"     INTEGER NOT NULL DEFAULT 0,
        "targetGoLiveDate"    TIMESTAMPTZ,
        "actualGoLiveDate"    TIMESTAMPTZ,
        "assignedTo"          UUID,
        notes                 TEXT,
        metadata              JSONB,
        "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_onboarding_tenant ON client_onboardings (tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_onboarding_status ON client_onboardings (status);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS client_onboarding_items (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        onboarding_id   UUID NOT NULL REFERENCES client_onboardings(id) ON DELETE CASCADE,
        phase           VARCHAR(30) NOT NULL,
        title           VARCHAR(200) NOT NULL,
        description     TEXT,
        "sortOrder"     INTEGER NOT NULL DEFAULT 0,
        status          VARCHAR(20) NOT NULL DEFAULT 'pending',
        "assignedTo"    UUID,
        "dueDate"       TIMESTAMPTZ,
        "completedAt"   TIMESTAMPTZ,
        notes           TEXT,
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_onboarding_item_onboarding ON client_onboarding_items (onboarding_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS client_onboarding_items;`);
    await queryRunner.query(`DROP TABLE IF EXISTS client_onboardings;`);
  }
}
