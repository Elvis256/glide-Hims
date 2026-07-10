import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 — Contract Management: creates the saas_contracts table.
 */
export class SaasContracts1782900000038 implements MigrationInterface {
  name = 'SaasContracts1782900000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS saas_contracts (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "contractNumber"      VARCHAR(30) NOT NULL,
        quotation_id          UUID,
        subscription_id       UUID,
        tenant_id             UUID,
        "clientName"          VARCHAR(200) NOT NULL,
        "clientOrganization"  VARCHAR(200),
        status                VARCHAR(30) NOT NULL DEFAULT 'draft',
        "contractType"        VARCHAR(50) NOT NULL DEFAULT 'saas_subscription',
        "startDate"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        "endDate"             TIMESTAMPTZ,
        "totalValueMinor"     INTEGER NOT NULL DEFAULT 0,
        currency              VARCHAR(3) NOT NULL DEFAULT 'UGX',
        "autoRenew"           BOOLEAN NOT NULL DEFAULT true,
        "renewalNoticeDays"   INTEGER NOT NULL DEFAULT 30,
        "termsText"           TEXT,
        signatories           JSONB,
        notes                 TEXT,
        "createdBy"           UUID,
        metadata              JSONB,
        "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_number ON saas_contracts ("contractNumber");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_contract_quotation ON saas_contracts (quotation_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_contract_tenant ON saas_contracts (tenant_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_contract_status ON saas_contracts (status);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS saas_contracts;`);
  }
}
