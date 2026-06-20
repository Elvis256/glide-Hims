import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 — Client Health Monitoring: creates health score tracking table.
 */
export class ClientHealthScores1782900000040 implements MigrationInterface {
  name = 'ClientHealthScores1782900000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS client_health_scores (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id             UUID NOT NULL,
        subscription_id       UUID,
        "overallScore"        INTEGER NOT NULL DEFAULT 0,
        "healthStatus"        VARCHAR(20) NOT NULL DEFAULT 'healthy',
        "usageScore"          INTEGER NOT NULL DEFAULT 0,
        "paymentScore"        INTEGER NOT NULL DEFAULT 0,
        "supportScore"        INTEGER NOT NULL DEFAULT 0,
        "adoptionScore"       INTEGER NOT NULL DEFAULT 0,
        "deploymentScore"     INTEGER NOT NULL DEFAULT 0,
        "componentDetails"    JSONB,
        alerts                JSONB,
        "lastCalculatedAt"    TIMESTAMPTZ,
        "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_health_tenant ON client_health_scores (tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_health_status ON client_health_scores ("healthStatus");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS client_health_scores;`);
  }
}
